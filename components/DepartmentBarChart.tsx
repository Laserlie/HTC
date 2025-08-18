'use client';

import { useEffect, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  type ChartOptions,
  type AnimationSpec,
} from 'chart.js';
import ZoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Spinner from '@/components/ui/Spinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title, ZoomPlugin, ChartDataLabels);

type Props = {
  apiEndpoint: string;
  deptCode: string;
};

type DepartmentChartData = {
  deptcode: string;
  department: string;
  scannedCount: number;
  notScannedCount: number;
};

const departmentNames: { [key: string]: string } = {
  '06': 'Platform',
  '07': 'AC EMC Micro',
  '08': 'RF EMC Micro',
  '09': 'FUL FILL',
};

export default function DepartmentChartsContainer({ apiEndpoint, deptCode }: Props) {
  const [data, setData] = useState<DepartmentChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [inViewScanned, setInViewScanned] = useState(false);
  const [inViewNotScanned, setInViewNotScanned] = useState(false);

  const chartScannedRef = useRef<HTMLDivElement>(null);
  const chartNotScannedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInViewScanned(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (chartScannedRef.current) {
      observer.observe(chartScannedRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInViewNotScanned(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (chartNotScannedRef.current) {
      observer.observe(chartNotScannedRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiEndpoint);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch data');
        }
        const result: DepartmentChartData[] = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiEndpoint]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }
  
  const factoryTitle = deptCode === 'all' ? 'แผนก' : departmentNames[deptCode];
  
  const departmentDataMap = new Map<string, DepartmentChartData>();
  data.forEach(item => {
    departmentDataMap.set(item.department, item);
  });

  const allScannedData = data
    .map((d) => {
      const totalEmployees = d.scannedCount + d.notScannedCount;
      const attendancePercentage = totalEmployees > 0 ? (d.scannedCount / totalEmployees) * 100 : 0;
      return {
        ...d,
        attendancePercentage: parseFloat(attendancePercentage.toFixed(2)), 
      };
    })
    .sort((a, b) => b.attendancePercentage - a.attendancePercentage); 

  const chartDataScanned = {
    labels: allScannedData.map((d) => d.department),
    datasets: [
      {
        label: 'เปอร์เซ็นต์การเข้างาน ',
        data: allScannedData.map((d) => d.attendancePercentage),
        backgroundColor: '#4CAF50',
      },
    ],
  };

  const animationOptions: AnimationSpec<'bar'> = {
    duration: 1000,
    easing: 'easeOutQuart',
  };

  const optionsScanned: ChartOptions<'bar'> = {
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `เปอร์เซ็นต์การเข้างานของพนักงาน ${factoryTitle}`,
        position: 'top',
        align: 'start',
        font: {
          size: 16,
          weight: 'bold',
        }
      },
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: false }, pinch: { enabled: false }, mode: 'x' },
      },
      datalabels: {
        display: (context) => {
          const chart = context.chart;
          const visibleLabels = chart.scales.x.ticks.length;
          return visibleLabels <= 20; 
        },
        anchor: 'end',
        align: 'end',
        offset: 6,
        color: '#878787',
        font: { weight: 'bold' },
        formatter: (value) => `${value}%`, 
      },
      tooltip: {
        callbacks: {
          title: (context) => {
            return context[0].label; 
          },
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y.toLocaleString()}%`;
            }
            return label;
          },
          afterLabel: (context) => {
            const departmentName = context.label;
            const departmentInfo = departmentDataMap.get(departmentName);
            if (departmentInfo) {
              const totalEmployees = departmentInfo.scannedCount + departmentInfo.notScannedCount;
              return `พนักงานในแผนก: ${totalEmployees.toLocaleString()} คน\nสแกนเข้าแล้ว: ${departmentInfo.scannedCount.toLocaleString()} คน`;
            }
            return '';
          }
        }
      }
    },
    animation: inViewScanned ? animationOptions : false,
    scales: {
      x: {
        title: { display: true, text: '' },
        ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 },
      },
      y: {
        beginAtZero: true,
        max: 100, 
        ticks: { precision: 0, callback: (value) => `${value}%` }, 
        title: { display: true, text: 'เปอร์เซ็นต์ (%)' },
      },
    },
  };

  const allNotScannedData = data
    .map((d) => {
      const totalEmployees = d.scannedCount + d.notScannedCount;
      const notScannedPercentage = totalEmployees > 0 ? (d.notScannedCount / totalEmployees) * 100 : 0;
      return {
        ...d,
        notScannedPercentage: parseFloat(notScannedPercentage.toFixed(2)), 
      };
    })
    .sort((a, b) => b.notScannedPercentage - a.notScannedPercentage); 

  const chartDataNotScanned = {
    labels: allNotScannedData.map((d) => d.department),
    datasets: [
      {
        label: 'เปอร์เซ็นต์ยังไม่สแกน ',
        data: allNotScannedData.map((d) => d.notScannedPercentage),
        backgroundColor: '#FFC107',
      },
    ],
  };

  const optionsNotScanned: ChartOptions<'bar'> = {
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `เปอร์เซ็นต์พนักงานที่ยังไม่สแกน ${factoryTitle}`,
        position: 'top',
        align: 'start',
        font: {
          size: 16,
          weight: 'bold',
        }
      },
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: false }, pinch: { enabled: false }, mode: 'x' },
      },
      datalabels: {
        display: (context) => {
          const chart = context.chart;
          const visibleLabels = chart.scales.x.ticks.length;
          return visibleLabels <= 20;
        },
        anchor: 'end',
        align: 'end',
        offset: 6,
        color: '#878787',
        font: { weight: 'bold' },
        formatter: (value) => `${value}%`, 
      },
      tooltip: {
        callbacks: {
          title: (context) => {
            return context[0].label; 
          },
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y.toLocaleString()}%`; 
            }
            return label;
          },
          afterLabel: (context) => {
            const departmentName = context.label;
            const departmentInfo = departmentDataMap.get(departmentName);
            if (departmentInfo) {
              const totalEmployees = departmentInfo.scannedCount + departmentInfo.notScannedCount;
              return `พนักงานในแผนก: ${totalEmployees.toLocaleString()} คน\nยังไม่สแกน: ${departmentInfo.notScannedCount.toLocaleString()} คน`;
            }
            return '';
          }
        }
      }
    },
    animation: inViewNotScanned ? animationOptions : false,
    scales: {
      x: {
        title: { display: true, text: '' },
        ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 },
      },
      y: {
        beginAtZero: true,
        max: 100, 
        ticks: { precision: 0, callback: (value) => `${value}%` }, 
        title: { display: true, text: 'เปอร์เซ็นต์ (%)' },
      },
    },
  };

  const allDepartmentLabels = Array.from(departmentDataMap.keys());
  const maxDepartments = allDepartmentLabels.length;
  const baseBarWidth = 50;
  const calculatedChartWidth = Math.max(400, maxDepartments * baseBarWidth);

  return (
    <div className="flex flex-col md:flex-row gap-8 justify-center items-start">
      {allScannedData.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow w-full md:w-1/2 overflow-x-auto" ref={chartScannedRef}>
          <div style={{ height: '400px', width: `${calculatedChartWidth}px` }}>
            <Bar data={chartDataScanned} options={optionsScanned} />
          </div>
        </div>
      )}

      {allNotScannedData.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow w-full md:w-1/2 overflow-x-auto" ref={chartNotScannedRef}>
          <div style={{ height: '400px', width: `${calculatedChartWidth}px` }}>
            <Bar data={chartDataNotScanned} options={optionsNotScanned} />
          </div>
        </div>
      )}
    </div>
  );
}
