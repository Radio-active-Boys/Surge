from flask import Flask, request, jsonify
from flask_cors import CORS
from opensees_runner import OpenSeesRunner
import openseespy.opensees as ops
import traceback
import os
import shutil
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
@app.route('/run-analysis', methods=['POST'])
def run_analysis():
    try:
        data = request.json or {}
        nodes = data.get("nodes", [])
        # 1) Quick validation: must have at least one node
        if not nodes:
            return jsonify({
                "status": "validation_error",
                "message": "Cannot run analysis: no nodes defined in the model."
            }), 400

        runner = OpenSeesRunner(data)
        results = runner.run()
        return jsonify(results)

    except Exception as e:
        return jsonify({
            "status": "server_error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }), 500

@app.route('/cleanup-output', methods=['POST'])
def cleanup_output():
    try:
        data = request.json
        output_dir = data.get("output_dir")
        current_dir = os.getcwd()
        
        if not output_dir or not os.path.exists(output_dir):
            return jsonify({"status": "error", "message": "Invalid output directory"}), 400
        
        # Security check - ensure path is within current directory
        if not os.path.abspath(output_dir).startswith(os.path.abspath(current_dir)):
            return jsonify({"status": "error", "message": "Unauthorized path"}), 403
        
        # Prevent deletion of critical directories
        critical_dirs = [
            os.path.abspath(current_dir),
            os.path.abspath(os.path.join(current_dir, "..")),
            os.path.abspath("/"),
            os.path.abspath("C:\\") if os.name == 'nt' else None
        ]
        
        if any(os.path.abspath(output_dir) == d for d in critical_dirs if d):
            return jsonify({"status": "error", "message": "Critical directory protection"}), 403
        
        # Only delete OpenSees output directories
        if "opensees_output_" not in os.path.basename(output_dir):
            return jsonify({"status": "error", "message": "Not an OpenSees output directory"}), 400
        ops.wipe()
        shutil.rmtree(output_dir)
        return jsonify({"status": "success", "message": f"Cleaned up {output_dir}"})
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=True)
