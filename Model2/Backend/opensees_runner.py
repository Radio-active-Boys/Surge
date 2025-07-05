import openseespy.opensees as ops
import os
import traceback
import json
import time
import shutil
import uuid
from collections import defaultdict

class OpenSeesRunner:
    def __init__(self, json_data):
        self.data = json_data
        self.results = {
            "status": "success",
            "model": {},
            "analysis": {},
            "recorders": {},
            "monitoring": {},
            "output_dir": "",
            "warnings": [],
            "errors": []
        }
        self.original_dir = os.getcwd()
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        self.output_dir = os.path.join(self.original_dir, f"opensees_output_{timestamp}_{unique_id}")
        os.makedirs(self.output_dir, exist_ok=True)
        self.results["output_dir"] = self.output_dir
        os.chdir(self.output_dir)
        self.current_time = 0.0

    def execute_command(self, cmd_dict):
        try:
            command = cmd_dict["command"]
            args    = cmd_dict.get("args", [])
            params  = cmd_dict.get("params", {})
            func    = getattr(ops, command)
            all_args = []

            all_args.extend(args)
            for k, v in params.items():
                all_args.append(f"-{k}")
                if isinstance(v, list):
                    all_args.extend(v)
                else:
                    all_args.append(v)
            return func(*all_args)
        except Exception as e:
            self.results["status"] = f"command_error: {command} - {e}"
            self.results["errors"].append({
                "command": command,
                "args": args,
                "params": params,
                "error": str(e)
            })
            raise

    def build_model(self):
        try:
            ops.wipe()
            if "model_config" in self.data:
                cfg = self.data["model_config"]
                ops.model('basic', '-ndm', cfg["ndm"], '-ndf', cfg["ndf"])
            steps = [
                ("nodes", self.build_nodes),
                ("boundary_conditions", self.build_boundary_conditions),
                ("materials", self.build_materials),
                ("sections", self.build_sections),
                ("transformations", self.build_transformations),
                ("integrations", self.build_integrations),
                ("elements", self.build_elements),
                ("time_series", self.build_time_series),
                ("patterns", self.build_patterns)
            ]
            for name, fn in steps:
                if name in self.data:
                    fn(self.data[name])
            return True
        except Exception as e:
            self.results["status"] = f"model_build_error: {e}"
            return False

    def build_nodes(self, nodes):
        for node in nodes:
            self.execute_command(node)
            if "mass" in node:
                tag = node["args"][0]
                ops.mass(tag, *node["mass"])
                self.record_node_info(tag, {"mass": node["mass"]})

    def build_boundary_conditions(self, bcs):
        for bc in bcs:
            self.execute_command(bc)

    def build_materials(self, mats):
        for m in mats:
            self.execute_command(m)

    def build_sections(self, secs):
        for sec in secs:
            self.execute_command(sec)
            if "fibers" in sec:
                for f in sec["fibers"]:
                    self.execute_command(f)
            if "patch" in sec:
                self.execute_command(sec["patch"])

    def build_transformations(self, trans):
        for t in trans:
            self.execute_command(t)

    def build_integrations(self, ints):
        for i in ints:
            self.execute_command(i)

    def build_elements(self, elems):
        for e in elems:
            self.execute_command(e)

    def build_time_series(self, ts):
        for t in ts:
            self.execute_command(t)

    def build_patterns(self, patterns):
        for p in patterns:
            self.execute_command(p)
            if "loads" in p:
                for l in p["loads"]:
                    self.execute_command(l)
            if "sp_constraints" in p:
                for spc in p["sp_constraints"]:
                    self.execute_command(spc)

    def setup_recorders(self):
        if "recorders" not in self.data:
            return
        for rec in self.data["recorders"]:
            try:
                if "-file" in rec["args"]:
                    idx = rec["args"].index("-file") + 1
                    path = rec["args"][idx]

                    self.execute_command(rec)
            except Exception as e:
                self.results["warnings"].append(f"Recorder setup failed: {e}")

    def run_analysis_sequence(self):
        if "analysis_sequence" not in self.data:
            return
        for step in self.data["analysis_sequence"]:
            try:
                if self.results["status"] != "success" and step.get("optional", False):
                    continue
                res = self.execute_command(step)
                if step["command"] == "analyze" and res != 0:
                    self.results["status"] = f"analysis_failed: code {res}"
                    break
                if self.should_capture_monitoring():
                    self.capture_monitoring_data()
            except Exception as e:
                if step.get("optional", False):
                    self.results["warnings"].append(f"Optional step skipped: {step['command']} - {e}")
                else:
                    raise

    def should_capture_monitoring(self):
        return "monitoring" in self.data and self.data["monitoring"].get("capture_during_analysis", True)

    def capture_monitoring_data(self):
        mon = self.data["monitoring"]
        t   = ops.getTime()
        if abs(t - self.current_time) < 1e-10:
            return
        self.current_time = t
        if "time_history" not in self.results["monitoring"]:
            self.results["monitoring"]["time_history"] = []
        point = {"time": t}
        if "nodes" in mon:
            for nt in mon["nodes"]:
                d = {}
                for resp in mon.get("responses", ["disp"]):
                    if resp == "disp":  d["disp"]  = self.get_node_disp(nt)
                    if resp == "vel":   d["vel"]   = self.get_node_vel(nt)
                    if resp == "accel": d["accel"] = self.get_node_accel(nt)
                point[f"node_{nt}"] = d
        if "elements" in mon:
            for et in mon["elements"]:
                d = {}
                for resp in mon.get("responses", ["forces"]):
                    if resp == "forces":      d["forces"]      = self.get_ele_forces(et)
                    if resp == "deformation": d["deformation"] = self.get_ele_response(et, "deformation")
                point[f"ele_{et}"] = d
        self.results["monitoring"]["time_history"].append(point)

    def get_node_disp(self, tag):
        try:    return ops.nodeDisp(tag)
        except: return None
    def get_node_vel(self, tag):
        try:    return ops.nodeVel(tag)
        except: return None
    def get_node_accel(self, tag):
        try:    return ops.nodeAccel(tag)
        except: return None
    def get_node_reaction(self, tag):
        try:    return ops.nodeReaction(tag)
        except: return None
    def get_ele_forces(self, tag):
        try:    return ops.eleForce(tag)
        except: return None
    def get_ele_response(self, tag, resp):
        try:    return ops.eleResponse(tag, resp)
        except: return None

    def parse_recorder_columns(self, rec):
        args     = rec.get("args", [])
        rtype    = rec.get("name", "").lower()
        cols     = []
        has_time = "-time" in args
        if has_time:
            cols.append("time")

        def ints_after(flag):
            vals = []
            if flag in args:
                i = args.index(flag) + 1
                while i < len(args):
                    try:
                        iv = int(args[i])
                        vals.append(iv)
                        i += 1
                        continue
                    except:
                        break
            return vals

        # --- SECTION recorder with 2 cols/pt ---
        if rtype == "element" and "section" in args:
            eles = ints_after("-ele")
            resp = args[args.index("section") + 1]  # "force" or "deformation"
            # build map integrationTag -> N
            integ_map = {
                integ["args"][0]: integ["args"][2]
                for integ in self.data.get("integrations", [])
            }
            for e in eles:
                int_tag = next(
                    (E["args"][-1] for E in self.data.get("elements", []) if E["args"][0] == e),
                    None
                )
                pts = integ_map.get(int_tag, 1)
                for p in range(1, pts + 1):
                    if resp == "force":
                        cols.append(f"ele{e}_sec_force_pt{p}_axial")
                        cols.append(f"ele{e}_sec_force_pt{p}_moment")
                    else:  # deformation
                        cols.append(f"ele{e}_sec_deform_pt{p}_axialDeform")
                        cols.append(f"ele{e}_sec_deform_pt{p}_curvature")
            return cols

        # --- other element recorders ---
        if rtype == "element":
            eles = ints_after("-ele")
            resp = next((k for k in ["localForce","force","axialForce","basicForce","basicDeformation","deformation"] if k in args), None)
            if resp is None:
                resp = next((a for a in reversed(args) if not a.startswith("-") and not a.isdigit()), "force")

            if resp == "force":
                ndf = self.data.get("model_config", {}).get("ndf", 2)
                for e in eles:
                    cols.append(f"ele{e}_FX_i")
                    cols.append(f"ele{e}_FY_i")
                    if ndf == 3:
                        cols.append(f"ele{e}_MZ_i")
                    cols.append(f"ele{e}_FX_j")
                    cols.append(f"ele{e}_FY_j")
                    if ndf == 3:
                        cols.append(f"ele{e}_MZ_j")
                return cols

            if resp == "localForce":
                ndf = self.data.get("model_config", {}).get("ndf", 2)
                for e in eles:
                    cols.append(f"ele{e}_FX_i")
                    cols.append(f"ele{e}_FY_i")
                    if ndf == 3:
                        cols.append(f"ele{e}_MZ_i")
                    cols.append(f"ele{e}_FX_j")
                    cols.append(f"ele{e}_FY_j")
                    if ndf == 3:
                        cols.append(f"ele{e}_MZ_j")
                return cols

            if resp == "axialForce":
                for e in eles:
                    cols.append(f"ele{e}_axial")
                return cols

            if resp == "basicForce":
                ndf = self.data.get("model_config", {}).get("ndf", 2)
                for e in eles:
                    cols.append(f"ele{e}_P")
                    if ndf == 3:
                        cols.append(f"ele{e}_M_i")
                        cols.append(f"ele{e}_M_j")
                return cols

            if resp == "basicDeformation":
                ndf = self.data.get("model_config", {}).get("ndf", 2)
                for e in eles:
                    cols.append(f"ele{e}_delta")
                    if ndf == 3:
                        cols.append(f"ele{e}_theta_i")
                        cols.append(f"ele{e}_theta_j")
                return cols

            if resp == "deformation":
                for e in eles:
                    cols.append(f"ele{e}_deform")
                return cols

            for e in eles:
                cols.append(f"ele{e}_{resp}")
            return cols

        # --- node, drift, eigen, fallback unchanged ---
        if rtype == "node":
            nodes = ints_after("-node")
            dofs  = ints_after("-dof")
            resp  = next((a for a in reversed(args) if not a.startswith("-") and not a.isdigit()), "disp")
            for n in nodes:
                for d in dofs:
                    cols.append(f"node{n}_{resp}_DOF{d}")
            return cols

        if rtype == "drift":
            iN = ints_after("-iNode")
            jN = ints_after("-jNode")
            d  = ints_after("-dof")
            if iN and jN and d:
                cols.append(f"drift_i{iN[0]}_j{jN[0]}_DOF{d[0]}")
            else:
                cols.append("drift_unknown")
            return cols

        if rtype == "eigen":
            num = ints_after("-numEigen") or [1]
            for i in range(1, num[0] + 1):
                cols.append(f"mode{i}")
            return cols

        if has_time:
            return cols
        return [f"unknown_rec_{rtype}"]

    def collect_recorder_data(self):
        if "recorders" not in self.data:
            return
        ops.wipe()
        for rec in self.data["recorders"]:
            try:
                if "-file" not in rec["args"]:
                    continue
                idx = rec["args"].index("-file") + 1
                path = rec["args"][idx]
                if not os.path.exists(path):
                    continue
                with open(path) as f:
                    lines = f.read().splitlines()
                name = os.path.basename(path)
                cols = self.parse_recorder_columns(rec)
                entry = {
                    "type": rec.get("name", "unknown"),
                    "absolute_path": path,
                    "columns": cols,
                    "data": lines  
                }
                self.results["recorders"][name] = entry
            except Exception as e:
                self.results["warnings"].append(f"Recorder collect error: {e}")

    def capture_final_state(self):
        if "nodes" in self.data:
            for n in self.data["nodes"]:
                tag = n["args"][0]
                self.record_node_info(tag, {
                    "final_disp": self.get_node_disp(tag),
                    "final_vel":  self.get_node_vel(tag),
                    "final_accel":self.get_node_accel(tag),
                    "final_reaction":self.get_node_reaction(tag)
                })
        if "elements" in self.data:
            for e in self.data["elements"]:
                tag = e["args"][1]
                self.record_ele_info(tag, {
                    "forces": self.get_ele_forces(tag)
                })

    def record_node_info(self, tag, info):
        self.results["model"].setdefault("nodes", {})\
                             .setdefault(tag, {})\
                             .update(info)

    def record_ele_info(self, tag, info):
        self.results["model"].setdefault("elements", {})\
                             .setdefault(tag, {})\
                             .update(info)

    def run(self):
        try:
            # Build the model
            if not self.build_model():
                return self.results

            # ---- New: bail out if no DOF to solve ----
            num_nodes = len(self.data.get("nodes", []))
            ndf       = self.data.get("model_config", {}).get("ndf", 0)
            total_dof = num_nodes * ndf
            if total_dof == 0:
                self.results["status"] = "no_dof; analysis skipped"
                return self.results
            # -------------------------------------------

            # Set up recorders and run the analysis
            self.setup_recorders()
            self.run_analysis_sequence()

            # If you have monitoring but disabled capture during run
            if "monitoring" in self.data and not self.data["monitoring"].get("capture_during_analysis", True):
                self.capture_monitoring_data()

            # Capture final state, wipe, collect recorder output
            self.capture_final_state()
            import openseespy.opensees as ops
            ops.wipe()
            self.collect_recorder_data()

            return self.results

        except Exception as e:
            self.results["status"]    = f"critical_error: {e}"
            self.results["traceback"] = traceback.format_exc()
            return self.results

        finally:
            # Always return to original working dir
            os.chdir(self.original_dir)

    def cleanup_output(self):
        try:
            if os.path.exists(self.output_dir):
                shutil.rmtree(self.output_dir)
                self.results["output_cleaned"] = True
            else:
                self.results["output_cleaned"] = False
        except Exception as e:
            self.results["warnings"].append(f"Output cleanup failed: {e}")
            self.results["output_cleaned"] = False