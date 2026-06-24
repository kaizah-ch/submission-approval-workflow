import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../api/client';
import { Application } from '../types';

const schema = z.object({ title: z.string().min(3), category: z.string().min(1), description: z.string().optional(), amount: z.coerce.number().positive().optional() });
type FormValues = z.infer<typeof schema>;

export default function ApplicationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { category: 'PROCUREMENT' } });
  const { data: existing } = useQuery({ enabled: !!id, queryKey: ['application', id], queryFn: async () => (await api.get<Application>(`/applications/${id}`)).data });
  useEffect(() => {
    if (existing) reset({ title: existing.title, category: existing.category, description: existing.description ?? undefined, amount: existing.amount ? Number(existing.amount) : undefined });
  }, [existing, reset]);
  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = id ? await api.put(`/applications/${id}`, values) : await api.post('/applications', values);
      navigate(`/applicant/${data.id}`);
    } catch (e: any) { setError('root', { message: e.response?.data?.message || 'Save failed' }); }
  };
  return <div className="card max-w-2xl"><h1 className="mb-4 text-2xl font-bold">{id ? 'Edit Application' : 'New Application'}</h1>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div><label>Title</label><input className="input" {...register('title')} />{errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}</div>
      <div><label>Category</label><select className="input" {...register('category')}><option>PROCUREMENT</option><option>GRANT</option><option>TRAVEL</option><option>TRAINING</option><option>OTHER</option></select></div>
      <div><label>Description</label><textarea className="input" rows={5} {...register('description')} /></div>
      <div><label>Amount</label><input className="input" type="number" step="0.01" {...register('amount')} />{errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}</div>
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <button className="btn-primary" disabled={isSubmitting}>Save draft</button>
    </form>
  </div>;
}
