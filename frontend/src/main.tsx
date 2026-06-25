import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import './index.css';
import Layout, { getUser } from './components/Layout';
import RequireAuth from './components/RequireAuth';
import ApplicantList from './pages/ApplicantList';
import ApplicationDetail from './pages/ApplicationDetail';
import ApplicationForm from './pages/ApplicationForm';
import Login from './pages/Login';
import ReviewerDetail from './pages/ReviewerDetail';
import ReviewerQueue from './pages/ReviewerQueue';

function Home() {
  const user = getUser();
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={user.role === 'REVIEWER' ? '/reviewer' : '/applicant'} />;
}

const router = createBrowserRouter([{ path: '/', element: <Layout />, children: [
  { path: 'login', element: <Login /> },
  { element: <RequireAuth />, children: [
    { index: true, element: <Home /> },
    { path: 'applicant', element: <ApplicantList /> },
    { path: 'applicant/new', element: <ApplicationForm /> },
    { path: 'applicant/applications/:id/edit', element: <ApplicationForm /> },
    { path: 'applicant/:id', element: <ApplicationDetail /> },
    { path: 'reviewer', element: <ReviewerQueue /> },
    { path: 'reviewer/:id', element: <ReviewerDetail /> },
  ] },
]}]);

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>);
