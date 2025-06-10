import { useState } from 'react'
import { DataCentreProvider } from './components/middleware/DataHandler/DataCentreTruss2D.jsx'
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