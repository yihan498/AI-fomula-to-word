"""
latex_to_omml.py

Two-step conversion:
  1. LaTeX  →  MathML  (via latex2mathml library)
  2. MathML →  OMML    (recursive tree port from the existing JS converter)

Public API:
  latex_to_omml_element(latex_str, display='inline') → (lxml.etree.Element | None, error_str | None)
"""

import latex2mathml.converter
from lxml import etree

OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"


# ── helpers ────────────────────────────────────────────────────────────────

def _esc(text: str) -> str:
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


def _local(node) -> str:
    """Strip namespace URI from lxml tag, return lowercase local name."""
    tag = node.tag
    if isinstance(tag, str):
        return tag.split("}", 1)[1].lower() if "}" in tag else tag.lower()
    return ""


def _el_children(node):
    """Element children only (no text / comment / PI nodes)."""
    return [c for c in node if isinstance(c.tag, str)]


# ── MathML → OMML recursive converter ──────────────────────────────────────

def _convert_children(node) -> str:
    return "".join(_convert_node(c) for c in node)


def _convert_node(node) -> str:
    if node is None:
        return ""
    if not isinstance(node.tag, str):   # comment / PI
        return ""

    name = _local(node)

    # ── transparent containers ──────────────────────────────────────────
    if name in ("math", "mrow", "mstyle", "mpadded", "mphantom"):
        return _convert_children(node)

    if name == "semantics":
        for kid in _el_children(node):
            if _local(kid) not in ("annotation", "annotation-xml"):
                return _convert_node(kid)
        return ""

    if name in ("annotation", "annotation-xml"):
        return ""

    # ── leaf tokens ────────────────────────────────────────────────────
    if name == "mi":
        text = node.text or ""
        sty = "i" if len(text) == 1 else "p"
        return f'<m:r><m:rPr><m:sty m:val="{sty}"/></m:rPr><m:t>{_esc(text)}</m:t></m:r>'

    if name == "mn":
        return f'<m:r><m:t>{_esc(node.text or "")}</m:t></m:r>'

    if name == "mo":
        text = (node.text or "").strip()
        return f'<m:r><m:t>{_esc(text)}</m:t></m:r>'

    if name == "mtext":
        return f'<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>{_esc(node.text or "")}</m:t></m:r>'

    if name == "ms":
        return f'<m:r><m:t>&quot;{_esc(node.text or "")}&quot;</m:t></m:r>'

    if name == "mspace":
        return '<m:r><m:t xml:space="preserve"> </m:t></m:r>'

    # ── scripts ────────────────────────────────────────────────────────
    if name == "msup":
        kids = _el_children(node)
        if len(kids) < 2:
            return _convert_children(node)
        return (f"<m:sSup>"
                f"<m:e>{_convert_node(kids[0])}</m:e>"
                f"<m:sup>{_convert_node(kids[1])}</m:sup>"
                f"</m:sSup>")

    if name == "msub":
        kids = _el_children(node)
        if len(kids) < 2:
            return _convert_children(node)
        return (f"<m:sSub>"
                f"<m:e>{_convert_node(kids[0])}</m:e>"
                f"<m:sub>{_convert_node(kids[1])}</m:sub>"
                f"</m:sSub>")

    if name == "msubsup":
        kids = _el_children(node)
        if len(kids) < 3:
            return _convert_children(node)
        return (f"<m:sSubSup>"
                f"<m:e>{_convert_node(kids[0])}</m:e>"
                f"<m:sub>{_convert_node(kids[1])}</m:sub>"
                f"<m:sup>{_convert_node(kids[2])}</m:sup>"
                f"</m:sSubSup>")

    # ── fraction ───────────────────────────────────────────────────────
    if name == "mfrac":
        kids = _el_children(node)
        if len(kids) < 2:
            return _convert_children(node)
        return (f"<m:f>"
                f"<m:num>{_convert_node(kids[0])}</m:num>"
                f"<m:den>{_convert_node(kids[1])}</m:den>"
                f"</m:f>")

    # ── radicals ───────────────────────────────────────────────────────
    if name == "msqrt":
        return (f"<m:rad>"
                f"<m:radPr><m:degHide m:val=\"1\"/></m:radPr>"
                f"<m:deg/>"
                f"<m:e>{_convert_children(node)}</m:e>"
                f"</m:rad>")

    if name == "mroot":
        kids = _el_children(node)
        if len(kids) < 2:
            return _convert_children(node)
        return (f"<m:rad>"
                f"<m:deg>{_convert_node(kids[1])}</m:deg>"
                f"<m:e>{_convert_node(kids[0])}</m:e>"
                f"</m:rad>")

    # ── accents / limits ───────────────────────────────────────────────
    if name == "mover":
        kids = _el_children(node)
        if len(kids) < 2:
            return _convert_children(node)
        base = _convert_node(kids[0])
        over_text = kids[1].text or ""
        if over_text in ("\u00af", "\u203e", "\u2015"):
            return f'<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>{base}</m:e></m:bar>'
        return f'<m:acc><m:accPr><m:chr m:val="{_esc(over_text)}"/></m:accPr><m:e>{base}</m:e></m:acc>'

    if name == "munder":
        kids = _el_children(node)
        if len(kids) < 2:
            return _convert_children(node)
        return (f"<m:limLow>"
                f"<m:e>{_convert_node(kids[0])}</m:e>"
                f"<m:lim>{_convert_node(kids[1])}</m:lim>"
                f"</m:limLow>")

    if name == "munderover":
        kids = _el_children(node)
        if len(kids) < 3:
            return _convert_children(node)
        return (f"<m:nary>"
                f"<m:naryPr><m:limLoc m:val=\"undOvr\"/></m:naryPr>"
                f"<m:sub>{_convert_node(kids[1])}</m:sub>"
                f"<m:sup>{_convert_node(kids[2])}</m:sup>"
                f"<m:e>{_convert_node(kids[0])}</m:e>"
                f"</m:nary>")

    # ── brackets / fences ──────────────────────────────────────────────
    if name == "mfenced":
        open_ch  = node.get("open",  "(")
        close_ch = node.get("close", ")")
        sep_attr = node.get("separators", ",")
        sep_ch   = sep_attr[0] if sep_attr else ","
        inner    = _convert_children(node)
        return (f"<m:d>"
                f"<m:dPr>"
                f'<m:begChr m:val="{_esc(open_ch)}"/>'
                f'<m:sepChr m:val="{_esc(sep_ch)}"/>'
                f'<m:endChr m:val="{_esc(close_ch)}"/>'
                f"</m:dPr>"
                f"<m:e>{inner}</m:e>"
                f"</m:d>")

    # ── matrix ─────────────────────────────────────────────────────────
    if name == "mtable":
        rows = [c for c in _el_children(node) if _local(c) == "mtr"]
        first_row_cells = [c for c in _el_children(rows[0]) if _local(c) == "mtd"] if rows else []
        cols = len(first_row_cells) or 1
        rows_omml = ""
        for row in rows:
            cells = [c for c in _el_children(row) if _local(c) == "mtd"]
            cells_omml = "".join(f"<m:e>{_convert_children(c)}</m:e>" for c in cells)
            rows_omml += f"<m:mr>{cells_omml}</m:mr>"
        return (f"<m:m>"
                f"<m:mPr><m:mcs><m:mc><m:mcPr>"
                f'<m:count m:val="{cols}"/><m:mcJc m:val="center"/>'
                f"</m:mcPr></m:mc></m:mcs></m:mPr>"
                f"{rows_omml}"
                f"</m:m>")

    # ── default: recurse ───────────────────────────────────────────────
    return _convert_children(node)


# ── public API ─────────────────────────────────────────────────────────────

def latex_to_omml_element(latex_str: str, display: str = "inline"):
    """
    Convert a LaTeX string to an lxml Element representing OMML.

    Returns:
        (element, None)  on success
        (None, error_msg) on failure
    """
    try:
        # Step 1: LaTeX → MathML string
        mathml_str = latex2mathml.converter.convert(latex_str)

        # Step 2: Parse MathML with lxml
        mathml_el = etree.fromstring(mathml_str.encode("utf-8"))

        # Step 3: MathML → OMML inner content string
        inner = _convert_node(mathml_el)

        # Step 4: Wrap in oMath / oMathPara
        if display == "block":
            omml_str = (
                f'<m:oMathPara xmlns:m="{OMML_NS}">'
                f"<m:oMath>{inner}</m:oMath>"
                f"</m:oMathPara>"
            )
        else:
            omml_str = f'<m:oMath xmlns:m="{OMML_NS}">{inner}</m:oMath>'

        element = etree.fromstring(omml_str.encode("utf-8"))
        return element, None

    except Exception as exc:
        return None, str(exc)
