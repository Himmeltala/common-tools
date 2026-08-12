# -*- coding: utf-8 -*-
"""
MySQL 建表语句转换虚谷数据库 (Xugu) 脚本
用法:
    python mysql_to_xugu.py <输入.sql> [输出目录] [--encoding 编码]

输入: Navicat 导出的 MySQL 建表 SQL 文件 (如 face_management_info-2.sql)
输出: <输出目录>/<表名>_xugu.sql  (虚谷 DDL)
编码: 不指定时自动检测 (先尝试 UTF-8, 失败则回退 GBK)

转换规则 (虚谷要点):
  - 标识符一律大写, schema 前缀 SYSDBA. (可参数改)
  - 去反引号 / 库名前缀 / ENGINE / CHARACTER SET / COLLATE / USING BTREE
    / AUTO_INCREMENT / ON UPDATE / ROW_FORMAT / SET NAMES / IF EXISTS
  - AUTO_INCREMENT=N  -> alter table ... alter column ID BIGINT identity(N,1) primary key
  - int 主键 id -> BIGINT; 其余 int(n) -> INTEGER; bigint(n) -> BIGINT;
    tinyint/decimal/varchar/datetime/float/double 原样
  - 列注释 -> 内联 comment '...'; 表注释 -> comment on table X is '...'
  - 非主键索引 -> create index NAME on SYSDBA.X(COL);
"""
import os
import re
import sys

SCHEMA = "SYSDBA"

# 编码检测回退列表
_ENCODING_FALLBACK = ["gbk", "gb2312", "gb18030", "latin-1"]


def detect_encoding(filepath):
    """检测文件编码, 先尝试 UTF-8, 失败则依次回退 GBK 等"""
    with open(filepath, "rb") as f:
        raw = f.read()
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass
    for enc in _ENCODING_FALLBACK:
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            pass
    return "utf-8"


def xugu_type(t, is_pk):
    t = t.lower()
    if t.startswith("bigint"):
        return "bigint"
    if t.startswith("int"):
        return "bigint" if is_pk else "integer"
    if t.startswith("tinyint"):
        return "tinyint"
    if t.startswith(("longtext", "mediumtext", "tinytext")):
        return "text"
    if t.startswith(("varchar", "decimal", "datetime", "float", "double", "char", "text")):
        return t
    return t


def split_values(s):
    """按引号外逗号切分 VALUES 列表"""
    vals, cur, in_q = [], [], False
    for ch in s:
        if ch == "'":
            in_q = not in_q
            cur.append(ch)
        elif ch == "," and not in_q:
            vals.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
    vals.append("".join(cur).strip())
    return vals


def parse_create_table(mysql_sql):
    """解析 CREATE TABLE, 返回 dict: table/comment/seed/cols/indexes"""
    m = re.search(r"CREATE TABLE `?(?:\w+\.)?`?(\w+)`?", mysql_sql)
    table = m.group(1) if m else "T"
    m = re.search(r"COMMENT\s*=\s*'([^']*)'", mysql_sql)
    comment = m.group(1) if m else ""
    m = re.search(r"AUTO_INCREMENT\s*=\s*(\d+)", mysql_sql)
    seed = int(m.group(1)) if m else 1
    cols_block = re.search(r"CREATE TABLE.*?\((.*?)\)\s*(?:ENGINE|COMMENT)", mysql_sql, re.S).group(1)

    cols = []
    for cm in re.finditer(r"`(\w+)`\s+(\w+(?:\([^)]*\))?)(.*?)(?:,\s*(?=`)|$)", cols_block, re.S):
        name, typ, rest = cm.group(1), cm.group(2), cm.group(3)
        rest = rest.replace("\n", " ").strip()
        notnull = "NOT NULL" in rest.upper()
        cmt = re.search(r"COMMENT\s+'([^']*)'", rest)
        comment_ = cmt.group(1) if cmt else ""
        dflt = re.search(r"DEFAULT\s+([^\s,]+)", rest)
        default = dflt.group(1) if dflt else None
        cols.append({"name": name, "type": typ, "notnull": notnull,
                     "comment": comment_, "default": default})

    indexes = []
    for im in re.finditer(r"(?:INDEX|KEY)\s+`(\w+)`\s*\(\s*`(\w+)`\s*\)", cols_block):
        indexes.append((im.group(1), im.group(2)))
    return {"table": table, "comment": comment, "seed": seed,
            "cols": cols, "indexes": indexes}


def build_ddl(info):
    """生成虚谷 DDL 文本"""
    full = f"{SCHEMA}.{info['table'].upper()}"
    lines = []
    for c in info["cols"]:
        is_pk = c["name"].lower() == "id"
        seg = f"{c['name'].upper()} {xugu_type(c['type'], is_pk)}"
        if c["notnull"]:
            seg += " not null"
        if c["default"]:
            d = c["default"].split(" ON UPDATE")[0]
            if d.upper() == "CURRENT_TIMESTAMP":
                seg += " default CURRENT_TIMESTAMP"
            elif d.upper() != "NULL":
                seg += f" default {d}"
        if c["comment"]:
            seg += f" comment '{c['comment']}'"
        lines.append(seg)

    ddl = f"DROP TABLE {full};\n\n"
    ddl += f"CREATE TABLE {full}(\n" + ",\n".join(lines) + "\n);\n"
    if info["comment"]:
        ddl += f"comment on table {info['table'].upper()} is '{info['comment']}';\n\n"
    ddl += f"alter table {full} alter column ID BIGINT identity({info['seed']},1) primary key;\n"
    ddl += f"alter table {full} add constraint \"PK_{info['table'].upper()}\" primary key(ID);\n"
    for iname, icol in info["indexes"]:
        ddl += f"create index {iname.upper()} on {full}({icol.upper()});\n"
    return ddl


def parse_inserts(mysql_sql, info):
    """解析 INSERT 数据, 返回虚谷 INSERT 列表"""
    table = info["table"]
    col_names = [c["name"].upper() for c in info["cols"]]
    ncols = len(col_names)
    pattern = re.compile(
        r"INSERT INTO `" + re.escape(table) + r"`\s*"
        r"(?:\(([^)]*)\)\s*)?VALUES\s*\((.*?)\);", re.S)
    out, bad = [], []
    for i, m in enumerate(pattern.finditer(mysql_sql)):
        col_list, body = m.group(1), m.group(2)
        vals = split_values(body)
        if len(vals) != ncols:
            bad.append((i + 1, len(vals)))
            continue
        if col_list:
            cols = [c.strip().strip("`").upper() for c in col_list.split(",")]
            stmt = f"INSERT INTO {SCHEMA}.{table.upper()} ({', '.join(cols)}) VALUES ({', '.join(vals)});"
        else:
            stmt = f"INSERT INTO {SCHEMA}.{table.upper()} VALUES ({', '.join(vals)});"
        out.append(stmt)
    return out, bad


def convert(mysql_sql):
    """完整转换, 返回 (info, inserts, bad)"""
    info = parse_create_table(mysql_sql)
    inserts, bad = parse_inserts(mysql_sql, info)
    return info, inserts, bad


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    outdir = None
    encoding = None

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg in ("--encoding", "-e") and i + 1 < len(sys.argv):
            encoding = sys.argv[i + 1]
            i += 2
        elif not arg.startswith("-") and outdir is None:
            outdir = arg
            i += 1
        else:
            i += 1

    if outdir is None:
        outdir = os.path.dirname(os.path.abspath(src))
    if not os.path.exists(src):
        print(f"输入文件不存在: {src}")
        sys.exit(1)

    encoding = encoding or detect_encoding(src)
    print(f"使用编码: {encoding}")

    with open(src, encoding=encoding) as f:
        mysql = f.read()

    info, inserts, bad = convert(mysql)
    if bad:
        print(f"警告: {len(bad)} 条 INSERT 值数异常: {bad[:5]}")
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f"{info['table']}_xugu.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"-- {info['comment'] or info['table']} (MySQL 转 Xugu)\n")
        f.write(f"-- 源: {info['table']} (MySQL 5.6, Navicat 导出)\n")
        f.write(f"-- 目标: {SCHEMA}.{info['table'].upper()} (虚谷数据库)\n")
        f.write(f"-- 结构 {len(inserts)} 条\n\n")
        f.write(build_ddl(info))
        if inserts:
            f.write("\n-- ----------------------------\n")
            f.write(f"-- Records of {info['table'].upper()}\n")
            f.write("-- ----------------------------\n")
            f.write("\n".join(inserts) + "\n")
    print(f"完成: 表={info['table']} 列={len(info['cols'])} "
          f"种子={info['seed']} 索引={len(info['indexes'])} 成功={len(inserts)} 异常={len(bad)}")
    print(f"输出: {out}")


if __name__ == "__main__":
    main()
