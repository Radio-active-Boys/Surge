import { useState } from 'react'
// import StructuralViewer2D from './components/Scene'
import { DataCentreProvider } from './components/middleware/DataCentre.jsx'
import Home from './components/middleware/Home.jsx'
function App() {

  return (
    <>
    <DataCentreProvider>
     <Home />
    </DataCentreProvider>,
    </>
  )
}

export default App
