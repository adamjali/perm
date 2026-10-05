"""A workbook built from Python lists, for the loader tests.

NOT a test file: it asserts nothing and runs nothing on import. Cells are
written as inline strings with explicit references and blank cells are left
out entirely, the way Excel itself omits them, so a reader that indexes
cells by position instead of by reference fails here the way it would on an
agency's file.
"""
from __future__ import annotations

import io
import zipfile
from xml.sax.saxutils import escape

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"


def _col(j: int) -> str:
    s = ""
    j += 1
    while j:
        j, r = divmod(j - 1, 26)
        s = chr(65 + r) + s
    return s


def _sheet(rows: list[list]) -> str:
    out = []
    for i, row in enumerate(rows, start=1):
        cells = "".join(
            f'<c r="{_col(j)}{i}" t="inlineStr"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>'
            for j, v in enumerate(row) if v is not None and v != ""
        )
        out.append(f'<row r="{i}">{cells}</row>')
    return f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="{NS}"><sheetData>{"".join(out)}</sheetData></worksheet>'


def xlsx_bytes(sheets: dict[str, list[list]]) -> bytes:
    """A workbook whose tabs are `sheets` in order. The parts deliberately sit
    under reversed file numbers, so a reader assuming `sheet1.xml` is the first
    tab reads the wrong one."""
    names = list(sheets)
    n = len(names)
    files = {f"xl/worksheets/sheet{n - k}.xml": _sheet(sheets[name]) for k, name in enumerate(names)}
    rels = "".join(
        f'<Relationship Id="rId{k + 1}" Type="{REL_NS}/worksheet" Target="worksheets/sheet{n - k}.xml"/>'
        for k in range(n))
    tabs = "".join(f'<sheet name="{escape(name)}" sheetId="{k + 1}" r:id="rId{k + 1}"/>' for k, name in enumerate(names))
    files["xl/workbook.xml"] = f'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="{NS}" xmlns:r="{REL_NS}"><sheets>{tabs}</sheets></workbook>'
    files["xl/_rels/workbook.xml.rels"] = f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{PKG_REL}">{rels}</Relationships>'
    files["_rels/.rels"] = (f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{PKG_REL}">'
                            f'<Relationship Id="rId1" Type="{REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    files["[Content_Types].xml"] = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                                    '<Default Extension="xml" ContentType="application/xml"/></Types>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, xml in files.items():
            z.writestr(name, xml)
    return buf.getvalue()
