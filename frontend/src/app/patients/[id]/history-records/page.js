'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/common/Navbar';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, CalendarDays, Activity, AlertCircle } from 'lucide-react';

export default function PatientHistoryRecords() {
  const params = useParams();
  const router = useRouter();
  const { token, user, API_BASE_URL } = useAuth();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchPatient();
  }, [user]);

  const fetchPatient = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Patient not found or access denied.');
      }

      const data = await res.json();
      setPatient(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-teal-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="pulse-loader">
              <div></div>
              <div></div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-400">Loading patient records...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        ) : patient ? (
          <div className="space-y-6">
            {/* Patient Header Card */}
            <div className="glass p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                    {patient.name}
                  </h1>
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-bold uppercase tracking-widest mt-1">
                    Patient Diagnostic History & Records
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400 font-semibold space-y-1">
                  <p>Age: <span className="text-slate-700 dark:text-slate-300">{patient.age} yrs</span></p>
                  <p>Gender: <span className="text-slate-700 dark:text-slate-300 capitalize">{patient.gender}</span></p>
                  {patient.email && (
                    <p>Email: <span className="text-slate-700 dark:text-slate-300">{patient.email}</span></p>
                  )}
                  <p>Phone: <span className="text-slate-700 dark:text-slate-300">{patient.phoneNumber}</span></p>
                </div>
              </div>
            </div>

            {/* Medical History */}
            <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <ClipboardList className="h-5 w-5 text-teal-600" />
                Clinical Background & Medical History
              </h2>
              {patient.medicalHistory ? (
                <p className="text-slate-700 dark:text-slate-300 leading-6 text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {patient.medicalHistory}
                </p>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm italic p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  No medical history has been recorded for this patient.
                </p>
              )}
            </div>

            {/* Appointment History */}
            <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Appointment History
              </h2>

              {patient.appointments && patient.appointments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-widest text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-3">Date & Time</th>
                        <th className="pb-3">Reason</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {patient.appointments.map((appt) => (
                        <tr key={appt.id} className="hover:bg-slate-500/5 transition-colors">
                          <td className="py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {new Date(appt.appointmentDate).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                            })}
                            <span className="block text-xs text-slate-400 font-normal">
                              {new Date(appt.appointmentDate).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-500 dark:text-slate-400">
                            {appt.reason || 'No reason specified'}
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-extrabold tracking-wide uppercase ${
                                appt.status === 'COMPLETED'
                                  ? 'bg-teal-500/10 text-teal-600'
                                  : appt.status === 'CANCELLED'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-amber-500/10 text-amber-500'
                              }`}
                            >
                              {appt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm italic p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  No appointment history found for this patient.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
