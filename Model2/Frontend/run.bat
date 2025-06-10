@echo off
REM Create folder structure

REM API
mkdir src\api

REM Components
mkdir src\components\model-builder
mkdir src\components\analysis
mkdir src\components\visualization
mkdir src\components\common

REM Stores
mkdir src\stores

REM Pages
mkdir src\pages

REM Utils
mkdir src\utils

REM Create empty files

REM API files
echo. > src\api\openseesService.js
echo. > src\api\jsonTemplates.js

REM Model Builder Components
echo. > src\components\model-builder\NodeEditor.jsx
echo. > src\components\model-builder\MaterialEditor.jsx
echo. > src\components\model-builder\SectionEditor.jsx
echo. > src\components\model-builder\ElementBuilder.jsx

REM Analysis Components
echo. > src\components\analysis\AnalysisConfig.jsx
echo. > src\components\analysis\LoadPatterns.jsx
echo. > src\components\analysis\Recorders.jsx

REM Visualization Components
echo. > src\components\visualization\ModelViewer.jsx
echo. > src\components\visualization\ResultsPlotter.jsx
echo. > src\components\visualization\DeformationView.jsx

REM Common Components
echo. > src\components\common\JsonEditor.jsx
echo. > src\components\common\CommandPreview.jsx
echo. > src\components\common\OutputViewer.jsx

REM Stores
echo. > src\stores\useModelStore.js
echo. > src\stores\useAnalysisStore.js

REM Pages
echo. > src\pages\ModelBuilderPage.jsx
echo. > src\pages\AnalysisPage.jsx
echo. > src\pages\ResultsPage.jsx

REM Utils
echo. > src\utils\openSeesParser.js
echo. > src\utils\modelUtils.js

echo Folder structure created successfully.
pause
