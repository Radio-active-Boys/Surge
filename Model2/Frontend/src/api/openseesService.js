 // api/openseesService.js
import axios from 'axios';

const API_URL = 'http://localhost:5000';

export const runAnalysis = async (modelData) => {
  console.log("Data send to backend",modelData)
  try {
    const response = await axios.post(`${API_URL}/run-analysis`, modelData);
    return response.data;
  } catch (error) {
    console.error('Analysis failed:', error);
    return { status: 'error', message: error.message };
  }
};

export const cleanupOutput = async (outputDir) => {
  return axios.post(`${API_URL}/cleanup-output`, { output_dir: outputDir });
};

