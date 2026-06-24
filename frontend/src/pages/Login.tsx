import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Login() {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: 'applicant@example.com', password: 'Password123!' } });
  const navigate = useNavigate();
  const onSubmit = async (values: { email: string; password: string }) => {
    try {
      const { data } = await api.post('/auth/login', values);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(data.user.role === 'REVIEWER' ? '/reviewer' : '/applicant');
    } catch (e: any) { setError('root', { message: e.response?.data?.message || 'Login failed' }); }
  };
  return <div className="mx-auto max-w-md card">
    <h1 className="mb-4 text-2xl font-bold">Login</h1>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div><label>Email</label><input className="input" {...register('email', { required: true })} /></div>
      <div><label>Password</label><input className="input" type="password" {...register('password', { required: true })} /></div>
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <button disabled={isSubmitting} className="btn-primary w-full">Sign in</button>
    </form>
    <div className="mt-4 rounded bg-slate-100 p-3 text-sm">
      <p><b>Applicant:</b> applicant@example.com / Password123!</p>
      <p><b>Reviewer:</b> reviewer@example.com / Password123!</p>
    </div>
  </div>;
}
