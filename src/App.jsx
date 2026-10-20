import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PublishStory from './pages/PublishStory'
import Drafts from './pages/Drafts'
import Comments from './pages/Comments'
import Newsletter from './pages/Newsletter'
import Stories from './pages/Stories'
import Media from './pages/Media'
import Users from './pages/Users'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/publish" element={<ProtectedRoute><PublishStory /></ProtectedRoute>} />
          <Route path="/publish/:id" element={<ProtectedRoute><PublishStory /></ProtectedRoute>} />
          <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
          <Route path="/comments" element={<ProtectedRoute roles={['admin', 'editor']}><Comments /></ProtectedRoute>} />
          <Route path="/newsletter" element={<ProtectedRoute roles={['admin', 'editor']}><Newsletter /></ProtectedRoute>} />
          <Route path="/stories" element={<ProtectedRoute><Stories /></ProtectedRoute>} />
          <Route path="/media" element={<ProtectedRoute roles={['admin', 'editor']}><Media /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute roles={['admin', 'editor']}><Analytics /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
