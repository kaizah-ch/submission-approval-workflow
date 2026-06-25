import { Link, Outlet, useNavigate } from 'react-router-dom';
import { AppUser } from '../types';

export function getUser(): AppUser | null {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();
  const logout = () => { localStorage.clear(); navigate('/login', { replace: true }); };
  return <div>
    <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between p-4">
      <Link to="/" className="font-bold">Submission Workflow</Link>
      {user && <div className="flex items-center gap-4 text-sm"><span>{user.name} ({user.role})</span><button onClick={logout} className="btn-secondary">Logout</button></div>}
    </div></header>
    <main className="mx-auto max-w-5xl p-4"><Outlet /></main>
  </div>;
}
