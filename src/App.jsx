import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import GamePage from './pages/GamePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play/:id" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
