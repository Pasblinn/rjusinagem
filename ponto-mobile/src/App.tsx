import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PontoMobile } from '@/pages/PontoMobile'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ponto/:token" element={<PontoMobile />} />
        <Route path="*" element={<Navigate to="/ponto/invalid" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
