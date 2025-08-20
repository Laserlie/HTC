'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

type AttendanceRecord = {
  person_code: string;
  full_name: string;
  department_full_paths: string;
  deptname: string;
  PersonType: string;
  firstscantime: string | null; 
  lastscantime: string | null;  
  shiftname: string;
  workdate: string; 
};

type PersonInfo = {
  full_name: string;
  department_full_paths: string;
  person_code: string;
};

export default function ReportPersonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const person_code = params.person_code as string;

  const today = new Date();
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 6);

  const [from, setFrom] = useState(searchParams.get('from') || lastWeek.toISOString().split('T')[0]);
  const [to, setTo] = useState(searchParams.get('to') || today.toISOString().split('T')[0]);

  const [details, setDetails] = useState<AttendanceRecord[]>([]);
  const [personInfo, setPersonInfo] = useState<PersonInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isValidDate = (dateStr: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());

  const goBack = () => {
    router.back();
  };

  useEffect(() => {
    const controller = new AbortController();

    const invalidPerson = !person_code || person_code === 'undefined' || person_code === '';
    const invalidFromDate = !from || !isValidDate(from);
    const invalidToDate = !to || !isValidDate(to);

    if (invalidPerson || invalidFromDate || invalidToDate) {
      console.error('Invalid parameters:', { person_code, from, to });
      return;
    }

    const fetchPersonHistory = async () => {
      setLoading(true);
      const searchParamsForApi = new URLSearchParams();
      searchParamsForApi.append('person_code', person_code);
      searchParamsForApi.append('from', from);
      searchParamsForApi.append('to', to);

      try {
        const res = await fetch(`/api/attendance/report/person?person_code=${person_code}&from=${from}&to=${to}`);


        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch report detail data');
        }

        const data = await res.json();
        const sortedDetails = (data.records || []).sort((a: AttendanceRecord, b: AttendanceRecord) =>
          new Date(a.workdate).getTime() - new Date(b.workdate).getTime()
        );

        setDetails(sortedDetails);

        if (sortedDetails.length > 0) {
          setPersonInfo({
            full_name: sortedDetails[0].full_name,
            department_full_paths: sortedDetails[0].department_full_paths,
            person_code: sortedDetails[0].person_code,
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('An error occurred while fetching data:', err);
          setDetails([]);
          setPersonInfo(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPersonHistory();

    return () => controller.abort();
  }, [person_code, from, to]);

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return '-';
    }
  };

  const getOverIn = (time: string | null): string | null => {
    if (!time) return '-';

    const scanTime = new Date(time);
    const threshold = new Date(scanTime);
    threshold.setHours(8, 0, 0, 0);

    if (scanTime > threshold) {
      const diffMs = scanTime.getTime() - threshold.getTime();
      const diffDate = new Date(diffMs);
      return diffDate.toISOString().substr(11, 8); 
    }

    return '-';
  };

  const exportToCSV = () => {
    if (details.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Date', 'Status', 'Time In', 'Time Out', 'Over IN', 'Shift'];
    const rows = details.map((d) =>
      [
        d.workdate,
        d.firstscantime ? 'Scanned' : 'No Scan',
        formatTime(d.firstscantime),
        formatTime(d.lastscantime),
        getOverIn(d.firstscantime) || '-',
        d.shiftname,
      ].join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `attendance_${personInfo?.person_code}_${from}_to_${to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
  };

  if (!person_code || person_code === 'undefined') {
    return <div className="p-6 text-red-600">Employee code is invalid or missing.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-shadow shadow-md hover:shadow-lg"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      {loading && !personInfo ? (
        <div className="flex justify-center py-10">
          <Spinner/>
        </div>
      ) : personInfo ? (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              Attendance History 
            </h1>
            <div className="text-xl font-bold">
            Name : {personInfo.full_name}
            </div>
            <p className="text-gray-600">
              Employee ID : {personInfo.person_code} | Department : {personInfo.department_full_paths}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-row items-center gap-2">
              <span className="text-gray-700 text-sm font-medium">From :</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-slate-300 px-2 py-1 rounded"
              />
            </label>
            <label className="flex flex-row items-center gap-2">
              <span className="text-gray-700 text-sm font-medium">To :</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-slate-300 px-2 py-1 rounded"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg shadow text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-3 font-semibold">Date</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Shift Type</th>
                      <th className="p-3 font-semibold">Time In</th>
                      <th className="p-3 font-semibold">Time Out</th>
                      <th className="p-3 font-semibold">Over IN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.slice(0, rowsPerPage).map((d, idx) => (
                      <tr
                        key={d.workdate + d.person_code + idx}
                        className="border-b last:border-b-0"
                      >
                        <td className="p-3">{d.workdate}</td>
                        <td className="p-3">
                          {d.firstscantime ? (
                            'Scanned'
                          ) : (
                            <span className="text-red-600 font-semibold">No Scan</span>
                          )}
                        </td>
                        <td className="p-3">{d.shiftname}</td>
                        <td className="p-3">{formatTime(d.firstscantime)}</td>
                        <td className="p-3">{formatTime(d.lastscantime)}</td>
                        <td className="p-3">{getOverIn(d.firstscantime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {details.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No attendance records found for the selected date range.
                </div>
              )}

              {details.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                  <label htmlFor="rows-per-page" className="text-sm font-medium text-gray-700">
                    Rows per page:
                  </label>
                  <select
                    id="rows-per-page"
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    className="border border-slate-300 px-2 py-1 rounded"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={details.length}>All</option>
                  </select>
                  <button
                    onClick={exportToCSV}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Export CSV
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="p-6 text-center text-gray-500">
          No data found for this employee.
        </div>
      )}
    </div>
  );
}