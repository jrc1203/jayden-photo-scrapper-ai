import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { GalleryPage } from '@/pages/GalleryPage'
import { PersonDetailPage } from '@/pages/PersonDetailPage'
import { MindMapPage } from '@/pages/MindMapPage'
import { TagsPage } from '@/pages/TagsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PersonsPage } from '@/pages/PersonsPage'
import { ReactFlowProvider } from 'reactflow'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/gallery" replace />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="person/:personId" element={<PersonDetailPage />} />
        <Route path="persons" element={<PersonsPage />} />
        <Route path="mindmap" element={<ReactFlowProvider><MindMapPage /></ReactFlowProvider>} />
        <Route path="mindmap/:personId" element={<ReactFlowProvider><MindMapPage /></ReactFlowProvider>} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App