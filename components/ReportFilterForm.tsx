'use client';

import { useEffect, useState } from 'react';

type ReportApiRawDataForFilter = {
  deptcode: string; 
  deptname: string; 
};

type Props = {
  onSearch: (filters: { 
    from: string; 
    to: string; 
    factoryId: string; 
    mainDepartmentId: string; 
    subDepartmentId: string; 
    employeeId: string; 
  }) => void;
  initialFilters: { 
    from: string;
    to: string;
    factoryId: string; 
    mainDepartmentId: string; 
    subDepartmentId: string; 
    employeeId: string;
  };
};

type FactoryForDropdown = {
  factoryCode: string; 
  factoryName: string; 
};

type MainDepartmentForDropdown = {
  deptcodelevel2: string; 
  deptnamelevel2: string; 
  parentFactoryCode: string; 
};

type SubDepartmentForDropdown = {
  deptcodelevel3: string; 
  deptnamelevel3: string; 
  parentMainDepartmentCode: string;
  parentFactoryCode: string; 
};

const parseDeptCode = (fullDeptCode: string) => {
  const level1 = fullDeptCode.length >= 2 ? fullDeptCode.substring(0, 2) : '';
  const level2 = fullDeptCode.length >= 4 ? fullDeptCode.substring(0, 4) : '';
  const level3 = fullDeptCode.length >= 6 ? fullDeptCode.substring(0, 6) : ''; 
  return { level1, level2, level3 };
};

const getTodayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ReportFilterForm = ({ onSearch, initialFilters }: Props) => {
  const todayStr = getTodayString();
  const [from, setFrom] = useState(initialFilters.from || todayStr);
  const [to, setTo] = useState(initialFilters.to || todayStr);
  const [factoryId, setFactoryId] = useState(initialFilters.factoryId);
  const [mainDepartmentId, setMainDepartmentId] = useState(initialFilters.mainDepartmentId); 
  const [subDepartmentId, setSubDepartmentId] = useState(initialFilters.subDepartmentId); 
  const [scanStatus, setScanStatus] = useState(initialFilters.employeeId);
  const [factories, setFactories] = useState<FactoryForDropdown[]>([]);
  const [allMainDepartments, setAllMainDepartments] = useState<MainDepartmentForDropdown[]>([]);
  const [allSubDepartments, setAllSubDepartments] = useState<SubDepartmentForDropdown[]>([]); 
  const [filteredMainDepartments, setFilteredMainDepartments] = useState<MainDepartmentForDropdown[]>([]);
  const [filteredSubDepartments, setFilteredSubDepartments] = useState<SubDepartmentForDropdown[]>([]); 
  const [loadingData, setLoadingData] = useState(true); 
 
  useEffect(() => {
    setLoadingData(true);
    // เพิ่ม query string สำหรับวันที่
    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', to);
    fetch(`/api/manpower?${params.toString()}`) 
      .then(res => {
        if (!res.ok) { 
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: ReportApiRawDataForFilter[]) => { 
        if (Array.isArray(data)) { 
          const uniqueFactories: FactoryForDropdown[] = [];
          const seenFactoryCodes = new Set<string>(); 
          const uniqueMainDepartments: MainDepartmentForDropdown[] = [];
          const seenMainDeptCodes = new Set<string>(); 
          const uniqueSubDepartments: SubDepartmentForDropdown[] = []; 
          const seenSubDeptCodes = new Set<string>(); 
          const levelCodeToNameMap = new Map<string, string>(); 

          data.forEach(item => { 
            if (!item.deptcode || !item.deptname) return; 
            
            const { level1, level2, level3 } = parseDeptCode(item.deptcode);

            if (level1 && (!levelCodeToNameMap.has(level1) || item.deptname.length > (levelCodeToNameMap.get(level1)?.length || 0))) {
                levelCodeToNameMap.set(level1, item.deptname);
            }
            if (level2 && (!levelCodeToNameMap.has(level2) || item.deptname.length > (levelCodeToNameMap.get(level2)?.length || 0))) {
                levelCodeToNameMap.set(level2, item.deptname);
            }
            if (level3 && (!levelCodeToNameMap.has(level3) || item.deptname.length > (levelCodeToNameMap.get(level3)?.length || 0))) {
                levelCodeToNameMap.set(level3, item.deptname);
            }
            if (level1 && !seenFactoryCodes.has(level1)) {
              uniqueFactories.push({ 
                factoryCode: level1, 
                factoryName: levelCodeToNameMap.get(level1) || `โรงงาน ${level1}` 
              }); 
              seenFactoryCodes.add(level1);
            }
            if (level2 && level1 && !seenMainDeptCodes.has(level2)) {
                uniqueMainDepartments.push({ 
                    deptcodelevel2: level2, 
                    deptnamelevel2: levelCodeToNameMap.get(level2) || 'แผนกหลัก ${level2}',
                    parentFactoryCode: level1 
                });
                seenMainDeptCodes.add(level2);
            }
            if (level3 && level2 && level1 && !seenSubDeptCodes.has(level3)) {
                uniqueSubDepartments.push({
                    deptcodelevel3: level3,
                    deptnamelevel3: levelCodeToNameMap.get(level3) || item.deptname, 
                    parentMainDepartmentCode: level2,
                    parentFactoryCode: level1
                });
                seenSubDeptCodes.add(level3);
            }
          });

          setFactories(uniqueFactories);
          setAllMainDepartments(uniqueMainDepartments); 
          setAllSubDepartments(uniqueSubDepartments); 

        } else {
          console.warn('รูปแบบข้อมูลไม่ถูกต้อง: ข้อมูลไม่ใช่ Array', data);
          setFactories([]);
          setAllMainDepartments([]);
          setAllSubDepartments([]);
        }
      })
      .catch(err => {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', err);
        setFactories([]);
        setAllMainDepartments([]);
        setAllSubDepartments([]);
      })
      .finally(() => {
        setLoadingData(false); 
      });
  // ให้ useEffect ทำงานเมื่อ from หรือ to เปลี่ยน
  }, [from, to]); 

  useEffect(() => {
    let newFilteredMainDepartments: MainDepartmentForDropdown[] = [];

    if (factoryId === '') { 
      newFilteredMainDepartments = allMainDepartments; 
    } else { 
      newFilteredMainDepartments = allMainDepartments.filter(
        d => d.parentFactoryCode === factoryId 
      );
    }
    setFilteredMainDepartments(newFilteredMainDepartments);

    const currentMainDepartmentIsValid = newFilteredMainDepartments.some(d => d.deptcodelevel2 === mainDepartmentId);
    if (mainDepartmentId && !currentMainDepartmentIsValid) {
        setMainDepartmentId('');
    }
    if (!mainDepartmentId && newFilteredMainDepartments.length === 1) {
      setMainDepartmentId(newFilteredMainDepartments[0].deptcodelevel2);
    }
  }, [factoryId, allMainDepartments, mainDepartmentId]); 

  useEffect(() => {
    let newFilteredSubDepartments: SubDepartmentForDropdown[] = [];

    if (factoryId === '' && mainDepartmentId === '') { 
      newFilteredSubDepartments = allSubDepartments; 
    } else if (factoryId !== '' && mainDepartmentId === '') { 
      newFilteredSubDepartments = allSubDepartments.filter(
        s => s.parentFactoryCode === factoryId
      );
    } else if (factoryId !== '' && mainDepartmentId !== '') { 
      newFilteredSubDepartments = allSubDepartments.filter(
        s => s.parentFactoryCode === factoryId && s.parentMainDepartmentCode === mainDepartmentId
      );
    } else if (factoryId === '' && mainDepartmentId !== '') { 
        newFilteredSubDepartments = allSubDepartments.filter(
          s => s.parentMainDepartmentCode === mainDepartmentId
        );
    }
    
    setFilteredSubDepartments(newFilteredSubDepartments);

    const currentSubDepartmentIsValid = newFilteredSubDepartments.some(d => d.deptcodelevel3 === subDepartmentId);
    if (subDepartmentId && !currentSubDepartmentIsValid) {
        setSubDepartmentId('');
    }
    if (!subDepartmentId && newFilteredSubDepartments.length === 1) {
      setSubDepartmentId(newFilteredSubDepartments[0].deptcodelevel3);
    }
  }, [factoryId, mainDepartmentId, allSubDepartments, subDepartmentId]); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); 
    onSearch({ 
      from,
      to,
      factoryId,
      mainDepartmentId, 
      subDepartmentId, 
      employeeId: scanStatus 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl shadow">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4"> 
        {/* Date Range: From */}
        <div>
          <label className="block mb-1 font-medium">From</label>
          <input
            type="date"
            className="w-full border rounded px-2 py-1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        {/* Date Range: To */}
        <div>
          <label className="block mb-1 font-medium">To</label>
          <input
            type="date"
            className="w-full border rounded px-2 py-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        {/* Dropdown โรงงาน */}
        <div>
          <label className="block mb-1 font-medium">Factory</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={factoryId}
            onChange={(e) => {
              setFactoryId(e.target.value);
              setMainDepartmentId(''); 
              setSubDepartmentId(''); 
            }}
            disabled={loadingData}
          >
            <option key="default-factory" value="">
              {loadingData ? 'Loading...' : '-- All --'}
            </option>
            {factories.map((f, idx) => (
              <option key={`factory-${f.factoryCode}-${idx}`} value={f.factoryCode}>
                {f.factoryName}
              </option>
            ))}
          </select>
        </div>
        {/* Dropdown แผนกหลัก */}
        <div>
          <label className="block mb-1 font-medium">Department</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={mainDepartmentId}
            onChange={(e) => {
              setMainDepartmentId(e.target.value);
              setSubDepartmentId(''); 
            }}
            disabled={loadingData}
          >
            <option key="default-main-department" value="">
              {loadingData ? 'Loading...' : '-- All --'}
            </option>
            {filteredMainDepartments.map((d, idx) => (
              <option key={`main-department-${d.deptcodelevel2}-${idx}`} value={d.deptcodelevel2}>
                {d.deptnamelevel2}
              </option>
            ))}
          </select>
        </div>
        {/* Dropdown แผนกย่อย/ส่วนงาน */}
        <div>
          <label className="block mb-1 font-medium">Division</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={subDepartmentId}
            onChange={(e) => {
                setSubDepartmentId(e.target.value);
            }}
            disabled={loadingData}
          >
            <option key="default-sub-department" value="">
              {loadingData ? 'Loading...' : '-- All --'}
            </option>
            {filteredSubDepartments.map((d, idx) => (
              <option key={`sub-department-${d.deptcodelevel3}-${idx}`} value={d.deptcodelevel3}>
                {d.deptnamelevel3}
              </option>
            ))}
          </select>
        </div>
        {/* Dropdown สถานะการสแกน */}
        <div className="md:col-span-1"> 
          <label className="block mb-1 font-medium">Status</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={scanStatus}
            onChange={(e) => setScanStatus(e.target.value)}
            disabled={loadingData}
          >
            {loadingData ? (
              <option key="scan-status-loading" value="">
                Loading...
              </option>
            ) : (
              <>
                <option key="scan-status-all" value="all">
                  -- All --
                </option>
                <option key="scan-status-scanned" value="scanned">
                  Scanned
                </option>
                <option key="scan-status-notscanned" value="not_scanned">
                  Not Scan
                </option>
              </>
            )}
          </select>
        </div>
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center">
        Search
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none"/>
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </form>
  );
};

export default ReportFilterForm;