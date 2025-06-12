import openseespy.opensees as ops
import os
import traceback
import numpy as np
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
        
        # Create output directory in current working directory
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        self.output_dir = os.path.join(self.original_dir, f"opensees_output_{timestamp}_{unique_id}")
        os.makedirs(self.output_dir, exist_ok=True)
        self.results["output_dir"] = self.output_dir
        
        os.chdir(self.output_dir)
        self.current_time = 0.0

    def execute_command(self, cmd_dict):
        """Execute a single OpenSees command with proper type handling"""
        try:
            command = cmd_dict["command"]
            args = cmd_dict.get("args", [])
            params = cmd_dict.get("params", {})
            name = cmd_dict.get("name", None)
            
            # Get OpenSees function
            func = getattr(ops, command)
            
            # Prepare arguments maintaining original types
            all_args = []
            if name:
                all_args.append(name)
            
            # Add positional arguments (preserve types)
            all_args.extend(args)
            
            # Add keyword arguments as flag-value pairs
            for k, v in params.items():
                all_args.append(f"-{k}")
                if isinstance(v, list):
                    all_args.extend(v)
                else:
                    all_args.append(v)
            
            # Execute command
            return func(*all_args)
        except Exception as e:
            self.results["status"] = f"command_error: {command} - {str(e)}"
            self.results["errors"].append({
                "command": command,
                "args": args,
                "params": params,
                "error": str(e)
            })
            raise

    def build_model(self):
        """Build the OpenSees model from JSON data"""
        try:
            # Initialize model
            ops.wipe()
            if "model_config" in self.data:
                config = self.data["model_config"]
                ops.model('basic', '-ndm', config["ndm"], '-ndf', config["ndf"])
            
            # Define components in required order
            components = [
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
            
            # Process each component if present
            for comp_name, builder in components:
                if comp_name in self.data:
                    builder(self.data[comp_name])
            
            return True
        except Exception as e:
            self.results["status"] = f"model_build_error: {str(e)}"
            return False

    def build_nodes(self, nodes):
        for node in nodes:
            self.execute_command(node)
            # Record mass if specified
            if "mass" in node:
                node_tag = node["args"][0]
                ops.mass(node_tag, *node["mass"])
                self.record_node_info(node_tag, {"mass": node["mass"]})

    def build_boundary_conditions(self, bcs):
        for bc in bcs:
            self.execute_command(bc)

    def build_materials(self, materials):
        for mat in materials:
            self.execute_command(mat)

    def build_sections(self, sections):
        for sec in sections:
            self.execute_command(sec)
            # Handle nested components
            if "fibers" in sec:
                for fiber in sec["fibers"]:
                    self.execute_command(fiber)
            if "patch" in sec:
                self.execute_command(sec["patch"])

    def build_transformations(self, transformations):
        for trans in transformations:
            self.execute_command(trans)

    def build_integrations(self, integrations):
        for integ in integrations:
            self.execute_command(integ)

    def build_elements(self, elements):
        for elem in elements:
            self.execute_command(elem)

    def build_time_series(self, time_series):
        for ts in time_series:
            self.execute_command(ts)

    def build_patterns(self, patterns):
        for pattern in patterns:
            self.execute_command(pattern)
            # Handle nested loads
            if "loads" in pattern:
                for load in pattern["loads"]:
                    self.execute_command(load)

    def setup_recorders(self):
        """Set up recorders with absolute paths in output directory"""
        if "recorders" not in self.data:
            return
        
        for rec in self.data["recorders"]:
            try:
                # Process file paths to make them absolute
                if "-file" in rec["args"]:
                    file_index = rec["args"].index("-file") + 1
                    filename = rec["args"][file_index]
                    
                    # Create absolute path in output directory
                    abs_path = os.path.join(self.output_dir, filename)
                    rec["args"][file_index] = abs_path
                    
                    # Ensure directory exists
                    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                
                self.execute_command(rec)
            except Exception as e:
                self.results["warnings"].append(f"Recorder setup failed: {str(e)}")

    def run_analysis_sequence(self):
        """Execute the analysis sequence"""
        if "analysis_sequence" not in self.data:
            return
        
        for step in self.data["analysis_sequence"]:
            try:
                # Skip optional commands if analysis already failed
                if self.results["status"] != "success" and step.get("optional", False):
                    continue
                
                # Execute analysis command
                result = self.execute_command(step)
                
                # Handle analyze command status
                if step["command"] == "analyze":
                    if result != 0:
                        self.results["status"] = f"analysis_failed: code {result}"
                        break
                
                # Capture monitoring data after each command
                if self.should_capture_monitoring():
                    self.capture_monitoring_data()
            
            except Exception as e:
                if step.get("optional", False):
                    self.results["warnings"].append(f"Optional step skipped: {step['command']} - {str(e)}")
                else:
                    raise

    def should_capture_monitoring(self):
        """Check if we should capture monitoring data at this point"""
        return "monitoring" in self.data and self.data["monitoring"].get("capture_during_analysis", True)

    def capture_monitoring_data(self):
        """Capture real-time monitoring data"""
        monitoring = self.data["monitoring"]
        time = ops.getTime()
        
        # Only capture if time has changed
        if abs(time - self.current_time) < 1e-10:
            return
        
        self.current_time = time
        
        # Initialize data structure
        if "time_history" not in self.results["monitoring"]:
            self.results["monitoring"]["time_history"] = []
        
        time_point = {"time": time}
        
        # Capture node responses
        if "nodes" in monitoring:
            for node_tag in monitoring["nodes"]:
                node_data = {}
                for response in monitoring.get("responses", ["disp"]):
                    if response == "disp":
                        node_data["disp"] = self.get_node_disp(node_tag)
                    elif response == "vel":
                        node_data["vel"] = self.get_node_vel(node_tag)
                    elif response == "accel":
                        node_data["accel"] = self.get_node_accel(node_tag)
                time_point[f"node_{node_tag}"] = node_data
        
        # Capture element responses
        if "elements" in monitoring:
            for ele_tag in monitoring["elements"]:
                ele_data = {}
                for response in monitoring.get("responses", ["forces"]):
                    if response == "forces":
                        ele_data["forces"] = self.get_ele_forces(ele_tag)
                    elif response == "deformation":
                        # FIXED: Pass response type as argument
                        ele_data["deformation"] = self.get_ele_response(ele_tag, "deformation")
                time_point[f"ele_{ele_tag}"] = ele_data
        
        self.results["monitoring"]["time_history"].append(time_point)

    def get_node_disp(self, node_tag):
        try:
            return ops.nodeDisp(node_tag)
        except:
            return None

    def get_node_vel(self, node_tag):
        try:
            return ops.nodeVel(node_tag)
        except:
            return None

    def get_node_accel(self, node_tag):
        try:
            return ops.nodeAccel(node_tag)
        except:
            return None

    def get_ele_forces(self, ele_tag):
        try:
            return ops.eleForce(ele_tag)
        except:
            return None

    # FIXED: Added response_type parameter to eleResponse call
    def get_ele_response(self, ele_tag, response_type):
        try:
            return ops.eleResponse(ele_tag, response_type)
        except:
            return None

    def collect_recorder_data(self):
        """Collect data from recorder files using absolute paths"""
        if "recorders" not in self.data:
            return
        
        for rec in self.data["recorders"]:
            try:
                if "-file" in rec["args"]:
                    file_index = rec["args"].index("-file") + 1
                    abs_path = rec["args"][file_index]
                    
                    if os.path.exists(abs_path):
                        with open(abs_path, 'r') as f:
                            content = f.read().splitlines()
                        
                        # Store relative path in results
                        rel_path = os.path.relpath(abs_path, self.output_dir)
                        self.results["recorders"][rel_path] = {
                            "type": rec.get("name", "unknown"),
                            "absolute_path": abs_path,
                            "data": content
                        }
            except (IndexError, ValueError) as e:
                self.results["warnings"].append(f"Recorder config error: {str(e)}")

    def capture_final_state(self):
        """Capture the final state of the model"""
        # Capture node states
        if "nodes" in self.data:
            for node in self.data["nodes"]:
                node_tag = node["args"][0]
                self.record_node_info(node_tag, {
                    "final_disp": self.get_node_disp(node_tag),
                    "final_vel": self.get_node_vel(node_tag),
                    "final_accel": self.get_node_accel(node_tag)
                })
        
        # Capture element states
        if "elements" in self.data:
            for elem in self.data["elements"]:
                ele_tag = elem["args"][0]
                self.record_ele_info(ele_tag, {
                    "forces": self.get_ele_forces(ele_tag),
                    # FIXED: Removed problematic eleResponse call
                })

    def record_node_info(self, node_tag, info):
        """Record information about a node"""
        if "nodes" not in self.results["model"]:
            self.results["model"]["nodes"] = {}
        
        if node_tag not in self.results["model"]["nodes"]:
            self.results["model"]["nodes"][node_tag] = {}
        
        self.results["model"]["nodes"][node_tag].update(info)

    def record_ele_info(self, ele_tag, info):
        """Record information about an element"""
        if "elements" not in self.results["model"]:
            self.results["model"]["elements"] = {}
        
        if ele_tag not in self.results["model"]["elements"]:
            self.results["model"]["elements"][ele_tag] = {}
        
        self.results["model"]["elements"][ele_tag].update(info)

    def run(self):
        """Execute the full workflow"""
        try:
            # Build the model
            if not self.build_model():
                return self.results
            
            # Setup recorders with absolute paths
            self.setup_recorders()
            
            # Run the analysis sequence
            self.run_analysis_sequence()
            
            # Capture final monitoring if not captured during analysis
            if "monitoring" in self.data and not self.data["monitoring"].get("capture_during_analysis", True):
                self.capture_monitoring_data()
            
            # Collect recorder data
            self.collect_recorder_data()
            
            # Capture final state
            self.capture_final_state()
            
            return self.results
        except Exception as e:
            self.results["status"] = f"critical_error: {str(e)}"
            self.results["traceback"] = traceback.format_exc()
            return self.results
        finally:
            os.chdir(self.original_dir)

    def cleanup_output(self):
        """Clean up the output directory (call this after processing results)"""
        try:
            if os.path.exists(self.output_dir):
                shutil.rmtree(self.output_dir)
                self.results["output_cleaned"] = True
            else:
                self.results["output_cleaned"] = False
        except Exception as e:
            self.results["output_cleaned"] = False
            self.results["warnings"].append(f"Output cleanup failed: {str(e)}")