'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Spinner from './ui/Spinner';
import WeComSettingsTable from './WeComSettingsTable';

interface Employee {
  id: number;
  name: string;
  wecom_id: string;
  is_hod?: boolean;
}

interface Department {
  id: number;
  name: string;
  employees: Employee[];
}

export default function WeComSettingsForm() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hods, setHods] = useState<{ [deptId: number]: string }>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await axios.get('/api/department/list');
        setDepartments(res.data);

        const defaultHods: { [id: number]: string } = {};
        res.data.forEach((d: Department) => {
          const hod = d.employees.find((e) => e.is_hod);
          defaultHods[d.id] = hod ? hod.wecom_id : '';
        });
        setHods(defaultHods);
      } catch (err) {
        console.error(err);
        let message = 'โหลดข้อมูลไม่สำเร็จ';
        if (axios.isAxiosError(err)) {
          message =
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            message;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSuccess('');
    setError('');

    const invalid = Object.entries(hods).filter(([, id]) => id && !/^[a-zA-Z0-9_-]{3,32}$/.test(id));
    if (invalid.length > 0) {
      setError(`WeCom ID "${invalid.map(([, id]) => id).join(', ')}" ไม่ถูกต้อง`);
      return;
    }

    try {
      await axios.post('/api/attendance/hod-settings', hods);
      setSuccess('บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      const errorMessage =
        (axios.isAxiosError(err) && err.response?.data?.message) || 'บันทึกข้อมูลไม่สำเร็จ';
      setError(errorMessage);
    }
  };

  const handleReset = () => {
    setHods({});
    setSuccess('');
    setError('');
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-6 bg-white rounded-xl shadow space-y-6">
      <h2 className="text-xl font-bold"> Wecom Setting Hod</h2>

      <input
        type="text"
        placeholder="ค้นหาแผนก..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border px-4 py-2 rounded"
      />

      <WeComSettingsTable
        departments={filtered}
        hods={hods}
        setHods={setHods}
      />

      <div className="flex justify-between gap-4">
        <button onClick={handleReset} className="text-sm text-gray-500 hover:underline">
          รีเซ็ตทั้งหมด
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {success && <p className="text-green-500">{success}</p>}

      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
      >
        บันทึก
      </button>
    </div>
  );
}