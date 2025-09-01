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
    divisionId: string;
    employeeId: string;
  }) => void;
  initialFilters: {
    from: string;
    to: string;
    factoryId: string;
    mainDepartmentId: string;
    subDepartmentId: string;
    divisionId: string;
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

// เพิ่ม Type ใหม่สำหรับระดับที่ 4
type DivisionForDropdown = {
  deptcodelevel4: string;
  deptnamelevel4: string;
  parentSubDepartmentCode: string;
  parentMainDepartmentCode: string;
  parentFactoryCode: string;
};

const parseDeptCode = (fullDeptCode: string) => {
  const level1 = fullDeptCode.length >= 2 ? fullDeptCode.substring(0, 2) : '';
  const level2 = fullDeptCode.length >= 4 ? fullDeptCode.substring(0, 4) : '';
  const level3 = fullDeptCode.length >= 6 ? fullDeptCode.substring(0, 6) : '';
  const level4 = fullDeptCode.length >= 8 ? fullDeptCode.substring(0, 8) : '';
  return { level1, level2, level3, level4 };
};

const ReportFilterForm = ({ onSearch, initialFilters }: Props) => {
  const [from, setFrom] = useState(initialFilters.from || '');
  const [to, setTo] = useState(initialFilters.to || '');
  const [factoryId, setFactoryId] = useState(initialFilters.factoryId);
  const [mainDepartmentId, setMainDepartmentId] = useState(initialFilters.mainDepartmentId);
  const [subDepartmentId, setSubDepartmentId] = useState(initialFilters.subDepartmentId);
  const [divisionId, setDivisionId] = useState(initialFilters.divisionId);
  const [scanStatus, setScanStatus] = useState(initialFilters.employeeId);
  const [factories, setFactories] = useState<FactoryForDropdown[]>([]);
  const [allMainDepartments, setAllMainDepartments] = useState<MainDepartmentForDropdown[]>([]);
  const [allSubDepartments, setAllSubDepartments] = useState<SubDepartmentForDropdown[]>([]);
  const [allDivisions, setAllDivisions] = useState<DivisionForDropdown[]>([]);
  const [filteredMainDepartments, setFilteredMainDepartments] = useState<MainDepartmentForDropdown[]>([]);
  const [filteredSubDepartments, setFilteredSubDepartments] = useState<SubDepartmentForDropdown[]>([]);
  const [filteredDivisions, setFilteredDivisions] = useState<DivisionForDropdown[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!from || !to) {
      setFactories([]);
      setAllMainDepartments([]);
      setAllSubDepartments([]);
      setAllDivisions([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
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
          const uniqueDivisions: DivisionForDropdown[] = [];
          const seenDivisionCodes = new Set<string>();
          const levelCodeToNameMap = new Map<string, string>();

          data.forEach(item => {
            if (!item.deptcode || !item.deptname) return;

            const { level1, level2, level3, level4 } = parseDeptCode(item.deptcode);

            if (level1 && (!levelCodeToNameMap.has(level1) || item.deptname.length > (levelCodeToNameMap.get(level1)?.length || 0))) {
              levelCodeToNameMap.set(level1, item.deptname);
            }
            if (level2 && (!levelCodeToNameMap.has(level2) || item.deptname.length > (levelCodeToNameMap.get(level2)?.length || 0))) {
              levelCodeToNameMap.set(level2, item.deptname);
            }
            if (level3 && (!levelCodeToNameMap.has(level3) || item.deptname.length > (levelCodeToNameMap.get(level3)?.length || 0))) {
              levelCodeToNameMap.set(level3, item.deptname);
            }
            // เพิ่มการจัดการสำหรับระดับ 4
            if (level4 && (!levelCodeToNameMap.has(level4) || item.deptname.length > (levelCodeToNameMap.get(level4)?.length || 0))) {
              levelCodeToNameMap.set(level4, item.deptname);
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
                deptnamelevel2: levelCodeToNameMap.get(level2) || `แผนกหลัก ${level2}`,
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

            if (level4 && level3 && level2 && level1 && !seenDivisionCodes.has(level4)) {
              uniqueDivisions.push({
                deptcodelevel4: level4,
                deptnamelevel4: levelCodeToNameMap.get(level4) || item.deptname,
                parentSubDepartmentCode: level3,
                parentMainDepartmentCode: level2,
                parentFactoryCode: level1
              });
              seenDivisionCodes.add(level4);
            }
          });

          setFactories(uniqueFactories);
          setAllMainDepartments(uniqueMainDepartments);
          setAllSubDepartments(uniqueSubDepartments);
          setAllDivisions(uniqueDivisions);
        } else {
          console.warn('Invalid data format: Data is not an Array.', data);
          setFactories([]);
          setAllMainDepartments([]);
          setAllSubDepartments([]);
          setAllDivisions([]);
        }
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setFactories([]);
        setAllMainDepartments([]);
        setAllSubDepartments([]);
        setAllDivisions([]);
      })
      .finally(() => {
        setLoadingData(false);
      });
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


  useEffect(() => {
    let newFilteredDivisions: DivisionForDropdown[] = [];

    if (subDepartmentId === '') {

      if (mainDepartmentId !== '') {
        newFilteredDivisions = allDivisions.filter(
          d => d.parentMainDepartmentCode === mainDepartmentId
        );
      } else if (factoryId !== '') {
        newFilteredDivisions = allDivisions.filter(
          d => d.parentFactoryCode === factoryId
        );
      } else {
        newFilteredDivisions = allDivisions;
      }
    } else {
      newFilteredDivisions = allDivisions.filter(
        d => d.parentSubDepartmentCode === subDepartmentId
      );
    }

    setFilteredDivisions(newFilteredDivisions);

    const currentDivisionIsValid = newFilteredDivisions.some(d => d.deptcodelevel4 === divisionId);
    if (divisionId && !currentDivisionIsValid) {
      setDivisionId('');
    }
    if (!divisionId && newFilteredDivisions.length === 1) {
      setDivisionId(newFilteredDivisions[0].deptcodelevel4);
    }
  }, [factoryId, mainDepartmentId, subDepartmentId, allDivisions, divisionId]);


  useEffect(() => {
    setFrom(initialFilters.from || '');
    setTo(initialFilters.to || '');
    setFactoryId(initialFilters.factoryId);
    setMainDepartmentId(initialFilters.mainDepartmentId);
    setSubDepartmentId(initialFilters.subDepartmentId);
    setDivisionId(initialFilters.divisionId);
    setScanStatus(initialFilters.employeeId);
  }, [initialFilters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      from,
      to,
      factoryId,
      mainDepartmentId,
      subDepartmentId,
      divisionId,
      employeeId: scanStatus
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div>
          <label className="block mb-1 font-medium">From</label>
          <input
            type="date"
            className="w-full border rounded-lg px-2 py-1 shadow-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">To</label>
          <input
            type="date"
            className="w-full border rounded-lg px-2 py-1 shadow-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Factory</label>
          <select
            className="w-full border rounded-lg px-2 py-2 shadow-sm"
            value={factoryId}
            onChange={(e) => {
              setFactoryId(e.target.value);
              setMainDepartmentId('');
              setSubDepartmentId('');
              setDivisionId('');
            }}
            disabled={loadingData || !from || !to}
          >
            <option key="default-factory" value="">
              {!from || !to ? 'Please select date' : loadingData ? 'Loading...' : '-- All --'}
            </option>
            {factories.map((f, idx) => (
              <option key={`factory-${f.factoryCode}-${idx}`} value={f.factoryCode}>
                {f.factoryName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Department</label>
          <select
            className="w-full border rounded-lg px-2 py-2 shadow-sm"
            value={mainDepartmentId}
            onChange={(e) => {
              setMainDepartmentId(e.target.value);
              setSubDepartmentId('');
              setDivisionId('');
            }}
            disabled={loadingData || !from || !to}
          >
            <option key="default-main-department" value="">
              {!from || !to ? 'Please select date' : loadingData ? 'Loading...' : '-- All --'}
            </option>
            {filteredMainDepartments.map((d, idx) => (
              <option key={`main-department-${d.deptcodelevel2}-${idx}`} value={d.deptcodelevel2}>
                {d.deptnamelevel2}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Division</label>
          <select
            className="w-full border rounded-lg px-2 py-2 shadow-sm"
            value={subDepartmentId}
            onChange={(e) => {
              setSubDepartmentId(e.target.value);
              setDivisionId('');
            }}
            disabled={loadingData || !from || !to}
          >
            <option key="default-sub-department" value="">
              {!from || !to ? 'Please select date' : loadingData ? 'Loading...' : '-- All --'}
            </option>
            {filteredSubDepartments.map((d, idx) => (
              <option key={`sub-department-${d.deptcodelevel3}-${idx}`} value={d.deptcodelevel3}>
                {d.deptnamelevel3}
              </option>
            ))}
          </select>
        </div>
        {/* เพิ่ม Dropdown สำหรับระดับที่ 4 */}
        <div>
          <label className="block mb-1 font-medium">Sub-Division</label>
          <select
            className="w-full border rounded-lg px-2 py-2 shadow-sm"
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            disabled={loadingData || !from || !to}
          >
            <option key="default-division" value="">
              {!from || !to ? 'Please select date' : loadingData ? 'Loading...' : '-- All --'}
            </option>
            {filteredDivisions.map((d, idx) => (
              <option key={`division-${d.deptcodelevel4}-${idx}`} value={d.deptcodelevel4}>
                {d.deptnamelevel4}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 flex items-center justify-center shadow-lg"
          disabled={!from || !to || loadingData}
        >
          Search
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </form>
  );
};

export default ReportFilterForm;