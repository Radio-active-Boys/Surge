def _write_json_file(self, path: str, data_obj: dict):
    """Synchronous helper to write JSON to disk."""
    with open(path, "w") as f_json:
        json.dump(data_obj, f_json, indent=2)

def _write_py_file(self, path: str, text: str):
    """Synchronous helper to write Python script to disk."""
    with open(path, "w") as f_py:
        f_py.write(text)

def generate_opensees_script(self, json_data):
    """
    Convert the provided JSON dict into a minimal OpenSeesPy script.
    (Omitting any plotting; just builds, analyzes, prints results.)
    """
    lines = []

    # 1. Header, imports, and initial model
    title = json_data.get("metadata", {}).get("title", "Untitled Model")
    units = json_data.get("metadata", {}).get("units", "")
    lines.append(f"# Auto-generated OpenSeesPy model script")
    lines.append(f"# Title: {title}")
    if units:
        lines.append(f"# Units: {units}")
    lines.append("from openseespy.opensees import *")
    lines.append("")
    lines.append("wipe()")
    lines.append("model('basic', '-ndm', 2, '-ndf', 2)")
    lines.append("")

    # 2. Create Nodes
    lines.append("# --- Create Nodes ---")
    node_tags = []
    for node in json_data.get("nodes", []):
        try:
            tag = int(node["tag"])
            x = float(node["x"])
            y = float(node["y"])
        except (KeyError, ValueError):
            # skip node if invalid
            continue
        node_tags.append(tag)
        lines.append(f"node({tag}, {x}, {y})")
    lines.append("")

    # 3. Define Materials
    lines.append("# --- Define Materials ---")
    for mat in json_data.get("materials", []):
        mtag = mat.get("tag")
        mtype = mat.get("type")
        if mtag is None or mtype is None:
            lines.append("# Skipped a material with missing tag/type")
            continue

        if mtype == "Elastic":
            E = mat.get("E", 0)
            lines.append(f"uniaxialMaterial('Elastic', {mtag}, {E})")
        elif mtype == "Steel02":
            Fy = mat.get("Fy", 0)
            E = mat.get("E", 0)
            b = mat.get("b", 0)
            lines.append(f"uniaxialMaterial('Steel02', {mtag}, {Fy}, {E}, {b})")
        else:
            lines.append(f"# Unsupported material type: {mtype}")
    lines.append("")

    # 4. Create Elements
    lines.append("# --- Create Elements ---")
    for el in json_data.get("elements", []):
        etag = el.get("tag")
        etype = el.get("type", "")
        start = el.get("start")
        end = el.get("end")
        area = el.get("area")
        mat_id = el.get("material")
        if None in (etag, start, end, area, mat_id):
            lines.append("# Skipping element with missing fields")
            continue

        if etype.lower() == "truss":
            lines.append(f"element('Truss', {etag}, {start}, {end}, {area}, {mat_id})")
        else:
            lines.append(f"# Unsupported element type: {etype}")
    lines.append("")

    # 5. Apply Supports (BCs)
    lines.append("# --- Apply Supports (BCs) ---")
    for bc in json_data.get("supports", []):
        nid = bc.get("node")
        xd = bc.get("xd")
        yd = bc.get("yd")
        if None in (nid, xd, yd):
            continue
        lines.append(f"fix({nid}, {xd}, {yd})")
    lines.append("")

    # 6. Define Load Patterns & Nodal Loads
    lines.append("# --- Define Load Patterns & Nodal Loads ---")
    for lp in json_data.get("load_patterns", []):
        lptag = lp.get("tag")
        ts = lp.get("time_series", {})
        ts_type = ts.get("type")
        ts_tag = ts.get("tag")
        if None in (lptag, ts_type, ts_tag):
            continue
        lines.append(f"timeSeries('{ts_type}', {ts_tag})")
        lines.append(f"pattern('Plain', {lptag}, {ts_tag})")
        for load in json_data.get("forces", []):
            nid = load.get("node")
            xf = load.get("xf")
            yf = load.get("yf")
            if None in (nid, xf, yf):
                continue
            lines.append(f"load({nid}, {float(xf)}, {float(yf)})")
        break  # only first pattern for simplicity
    lines.append("")

    # 7. Analysis Settings
    settings = json_data.get("analysis_settings", {})
    lines.append("# --- Analysis Settings ---")
    cons = settings.get("constraints", "Plain")
    lines.append(f"constraints('{cons}')")
    sysm = settings.get("system", "BandSPD")
    lines.append(f"system('{sysm}')")
    numr = settings.get("numberer", "RCM")
    lines.append(f"numberer('{numr}')")
    integ = settings.get("integrator", {})
    itype = integ.get("type", "LoadControl")
    incr = integ.get("incr", 1.0)
    lines.append(f"integrator('{itype}', {incr})")
    alg = settings.get("algorithm", "Linear")
    lines.append(f"algorithm('{alg}')")
    analysis = settings.get("analysis", {})
    atype = analysis.get("type", "Static")
    steps = analysis.get("steps", 1)
    lines.append(f"analysis('{atype}')")
    lines.append("")

    # 8. Run Analysis
    lines.append("# --- Run Analysis ---")
    lines.append(f"ok = analyze({steps})")
    lines.append("if ok != 0:")
    lines.append("    print('WARNING: Analysis did not converge or failed')")
    lines.append("")

    # 9. Retrieve Results
    lines.append("# --- Retrieve Displacements & Reactions ---")
    lines.append("disp = {}")
    for tag in node_tags:
        lines.append(f"disp[{tag}] = nodeDisp({tag})")
    lines.append("")
    lines.append("react = {}")
    for tag in node_tags:
        lines.append(f"react[{tag}] = nodeReaction({tag})")
    lines.append("")

    # 10. Print Results
    lines.append("# --- Print Results ---")
    lines.append("print('=== NODAL DISPLACEMENTS ===')")
    lines.append("for nid, d in disp.items():")
    lines.append("    print(f'Node {nid}: ux = {d[0]:.6f}, uy = {d[1]:.6f}')")
    lines.append("")
    lines.append("print('=== NODAL REACTIONS ===')")
    lines.append("for nid, r in react.items():")
    lines.append("    print(f'Node {nid}: rx = {r[0]:.6f}, ry = {r[1]:.6f}')")
    lines.append("")

    # 11. End
    lines.append("# End of auto-generated OpenSeesPy script")
    lines.append("")

    return "\n".join(lines)
