/**
 * Foundation Database & Assignment Engine Workspace
 * Highly polished, relational-driven interactive structural design console.
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Database,
  Link2,
  Upload,
  ShieldCheck,
  Terminal,
  Cpu,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Settings2,
  Play,
  RotateCcw,
  Search,
  Scale,
  Construction,
  Info,
  Layers,
  FileCode2,
  Coins,
  Compass,
} from "lucide-react";
import {
  type FoundationDatabase,
  type FoundationRecord,
  type FoundationGeometryRecord,
  type FoundationAssignmentRecord,
  type FoundationLevelRecord,
  type FoundationTypeRecord,
  type FoundationGroupRecord,
  type SoilAssignmentRecord,
  type ValidationError,
  generateSeedDatabase,
  FoundationQueryAPI,
  DEFAULT_TYPES,
  DEFAULT_GROUPS,
} from "@/lib/foundationDatabase";
import type { Column } from "@/lib/structuralEngine";

interface Props {
  columns: Column[];
  colLoads3D?: Map<string, any>;
  etabsReactions?: any[];
}

export default function FoundationDatabaseWorkspace({
  columns,
  colLoads3D,
  etabsReactions,
}: Props) {
  // ─── INITIAL DB CONFIGURATION ───
  const [db, setDb] = useState<FoundationDatabase>(() => {
    const saved = localStorage.getItem("foundation_db_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved foundation DB, seeding new one");
      }
    }
    return generateSeedDatabase(columns);
  });

  // Keep query API in sync
  const queryAPI = useMemo(() => new FoundationQueryAPI(db), [db]);

  // Persist edits
  useEffect(() => {
    localStorage.setItem("foundation_db_v1", JSON.stringify(db));
  }, [db]);

  // Reset database helper
  const handleResetDatabase = () => {
    if (confirm("هل أنت متأكد من إعادة تهيئة قاعدة البيانات بالكامل؟ سيتم إعادة توليد القيم الافتراضية.")) {
      const freshDb = generateSeedDatabase(columns);
      setDb(freshDb);
    }
  };

  // ─── ACTIVE TABS ───
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"tables" | "assignment" | "etabs" | "validation" | "api" | "dependent">("tables");
  const [activeTable, setActiveTable] = useState<keyof FoundationDatabase>("Foundations");

  // ─── FILTER / SEARCH STATES ───
  const [searchTerm, setSearchTerm] = useState("");

  // ─── VALIDATION CACHE ───
  const validationErrors = useMemo(() => {
    return queryAPI.ValidateDatabase(columns);
  }, [queryAPI, columns]);

  // ─── API PLAYGROUND STATES ───
  const [apiSelectedFoundation, setApiSelectedFoundation] = useState<string>(
    db.Foundations[0]?.FoundationID || ""
  );
  const [apiSelectedMethod, setApiSelectedMethod] = useState<string>("GetFoundationLoads");
  const [apiOutput, setApiOutput] = useState<string>("// Run a test query to view structural payload...");

  // Sync selected foundation for API on load
  useEffect(() => {
    if (db.Foundations.length > 0 && !apiSelectedFoundation) {
      setApiSelectedFoundation(db.Foundations[0].FoundationID);
    }
  }, [db.Foundations, apiSelectedFoundation]);

  const runApiQuery = () => {
    if (!apiSelectedFoundation) {
      setApiOutput("// Error: Select a FoundationID to query.");
      return;
    }

    let result: any = null;
    switch (apiSelectedMethod) {
      case "GetFoundationByID":
        result = queryAPI.GetFoundationByID(apiSelectedFoundation);
        break;
      case "GetFoundationGeometry":
        result = queryAPI.GetFoundationGeometry(apiSelectedFoundation);
        break;
      case "GetSupportedObjects":
        result = queryAPI.GetSupportedObjects(apiSelectedFoundation);
        break;
      case "GetSoilProperties":
        result = queryAPI.GetSoilProperties(apiSelectedFoundation);
        break;
      case "GetLevels":
        result = queryAPI.GetLevels(apiSelectedFoundation);
        break;
      case "GetFoundationLoads":
        result = queryAPI.GetFoundationLoads(apiSelectedFoundation, columns, colLoads3D);
        break;
      default:
        result = { error: "Unknown query" };
    }

    setApiOutput(JSON.stringify(result, null, 2));
  };

  // Run automatically when dependencies change
  useEffect(() => {
    if (apiSelectedFoundation) {
      runApiQuery();
    }
  }, [apiSelectedFoundation, apiSelectedMethod, db]);

  // ─── BATCH INTEGRITY DIRECT AUTO-FIX ───
  const handleAutoFixIntegrity = () => {
    const unassignedCols = columns.filter(col => {
      // identify if bottom col
      const minZ = columns.length > 0 ? Math.min(...columns.map(c => c.zBottom ?? 0)) : 0;
      const isBottom = Math.abs((col.zBottom ?? 0) - minZ) < 500;
      if (!isBottom) return false;

      return !db.Assignment.some(
        a => a.ObjectType === 'Column' && a.ObjectID === col.id
      );
    });

    if (unassignedCols.length === 0 && validationErrors.length === 0) {
      alert("قاعدة البيانات سليمة تماماً! لا توجد أخطاء تتطلب الإصلاح التلقائي.");
      return;
    }

    let updatedFoundations = [...db.Foundations];
    let updatedGeometry = [...db.Geometry];
    let updatedAssignment = [...db.Assignment];
    let updatedLevels = [...db.Levels];
    let updatedSoil = [...db.Soil];

    // 1. Repair unassigned columns by creating standard isolated foundations
    unassignedCols.forEach(col => {
      const fId = `FD-AUTOFX-${col.id}`;
      // Check if already is listed
      if (!updatedFoundations.some(f => f.FoundationID === fId)) {
        updatedFoundations.push({
          FoundationID: fId,
          FoundationType: 'Isolated',
          Name: `FA-${col.id} (منفردة تلقائية)`,
          TopElevation: -500,
          BottomElevation: -1000,
          MaterialID: "C25_420",
          SoilPropertySet: "SP-SAND-1",
          DesignGroup: "FG-LIGHT",
          DrawingGroup: "DWG_ISO",
          Status: 'Design',
          UserNotes: `Auto-generated fixing database integrity for column ${col.id}`
        });

        updatedGeometry.push({
          FoundationID: fId,
          Shape: 'Square',
          Length: 1600,
          Width: 1600,
          Thickness: 500,
          Rotation: 0,
          Area: 2.56,
          Volume: 1.28
        });

        updatedAssignment.push({
          FoundationID: fId,
          ObjectType: 'Column',
          ObjectID: col.id
        });

        updatedLevels.push({
          FoundationID: fId,
          FoundationLevel: -1000,
          ReferenceLevel: "Ground Level",
          StepParentID: "",
          StepHeight: 0
        });

        updatedSoil.push({
          FoundationID: fId,
          SoilPropertyID: "SP-SAND-1",
          AllowableBearing: 150,
          Ks: 18000,
          Es: 30000,
          PoissonRatio: 0.28,
          GroundwaterCondition: 'Dry'
        });
      }
    });

    // 2. Clear out invalid references pointing to non-existent columns
    updatedAssignment = updatedAssignment.filter(as => {
      if (as.ObjectType === 'Column') {
        return columns.some(c => c.id === as.ObjectID);
      }
      return true;
    });

    // 3. Populate missing geometry or soil records for existing foundations
    updatedFoundations.forEach(f => {
      if (!updatedGeometry.some(g => g.FoundationID === f.FoundationID)) {
        updatedGeometry.push({
          FoundationID: f.FoundationID,
          Shape: 'Square',
          Length: 1800,
          Width: 1800,
          Thickness: 500,
          Rotation: 0,
          Area: 3.24,
          Volume: 1.62
        });
      }
      if (!updatedSoil.some(s => s.FoundationID === f.FoundationID)) {
        updatedSoil.push({
          FoundationID: f.FoundationID,
          SoilPropertyID: "SP-SAND-1",
          AllowableBearing: 150,
          Ks: 18000,
          Es: 30000,
          PoissonRatio: 0.28,
          GroundwaterCondition: 'Dry'
        });
      }
    });

    setDb({
      Foundations: updatedFoundations,
      Geometry: updatedGeometry,
      Assignment: updatedAssignment,
      Levels: updatedLevels,
      Types: db.Types,
      Groups: db.Groups,
      Soil: updatedSoil
    });
  };

  // ─── MANUAL CRUD OPERATORS ───
  const [editRecordDialog, setEditRecordDialog] = useState<any | null>(null);

  // Quick deletion helper
  const handleDeleteRow = (tableKey: keyof FoundationDatabase, primaryKeyVal: string, assignObjId?: string) => {
    const updated = { ...db };
    if (tableKey === 'Assignment' && assignObjId) {
      updated.Assignment = updated.Assignment.filter(
        row => !(row.FoundationID === primaryKeyVal && row.ObjectID === assignObjId)
      );
    } else {
      // standard tables delete by FoundationID
      (updated[tableKey] as any[]) = (updated[tableKey] as any[]).filter(
        (row: any) => row.FoundationID !== primaryKeyVal && row.TypeID !== primaryKeyVal && row.GroupID !== primaryKeyVal
      );
    }
    setDb(updated);
  };

  // Inline cell value editing handler
  const handleUpdateField = (
    tableKey: keyof FoundationDatabase,
    primaryKeyField: string,
    primaryKeyValue: string,
    fieldName: string,
    value: any
  ) => {
    const updated = { ...db };
    const list = updated[tableKey] as any[];
    const idx = list.findIndex(r => r[primaryKeyField] === primaryKeyValue);
    if (idx !== -1) {
      list[idx][fieldName] = typeof list[idx][fieldName] === 'number' ? parseFloat(value) || 0 : value;
      
      // Auto compute Area and Volume if Length/Width/Thickness edited
      if (tableKey === 'Geometry' && ['Length', 'Width', 'Thickness'].includes(fieldName)) {
        const row = list[idx] as FoundationGeometryRecord;
        row.Area = parseFloat(((row.Length * row.Width) / 1000000).toFixed(3));
        row.Volume = parseFloat(((row.Area * row.Thickness) / 1000).toFixed(3));
      }
      setDb(updated);
    }
  };

  const handleAddField = (tableKey: keyof FoundationDatabase) => {
    const updated = { ...db };
    const tempID = `FD-NEW-${Math.floor(Math.random() * 1000)}`;

    switch (tableKey) {
      case 'Foundations':
        updated.Foundations.push({
          FoundationID: tempID,
          FoundationType: 'Isolated',
          Name: `New Foundation ${tempID}`,
          TopElevation: -500,
          BottomElevation: -1000,
          MaterialID: "C25_420",
          SoilPropertySet: "SP-SAND-1",
          DesignGroup: "FG-LIGHT",
          DrawingGroup: "DWG_ISO",
          Status: 'Pending',
          UserNotes: "Manually registered database record"
        });
        // Auto add matching geometry & soil for completeness
        updated.Geometry.push({ FoundationID: tempID, Shape: 'Square', Length: 1800, Width: 1800, Thickness: 500, Rotation: 0, Area: 3.24, Volume: 1.62 });
        updated.Soil.push({ FoundationID: tempID, SoilPropertyID: "SP-SAND-1", AllowableBearing: 150, Ks: 18000, Es: 30000, PoissonRatio: 0.28, GroundwaterCondition: 'Dry' });
        updated.Levels.push({ FoundationID: tempID, FoundationLevel: -1000, ReferenceLevel: "Ground Level", StepParentID: "", StepHeight: 0 });
        break;
      case 'Assignment':
        if (db.Foundations.length > 0) {
          updated.Assignment.push({
            FoundationID: db.Foundations[0].FoundationID,
            ObjectType: 'Column',
            ObjectID: columns[0]?.id || "C1"
          });
        }
        break;
      case 'Levels':
        if (db.Foundations.length > 0) {
          updated.Levels.push({
            FoundationID: db.Foundations[0].FoundationID,
            FoundationLevel: -1000,
            ReferenceLevel: "Ground",
            StepParentID: "",
            StepHeight: 0
          });
        }
        break;
      default:
        break;
    }
    setDb(updated);
  };

  // ─── INTERACTIVE ASSIGNMENT ENGINE STATES ───
  const [selectedAssignmentCol, setSelectedAssignmentCol] = useState<string>("");
  const [selectedTargetFoundation, setSelectedTargetFoundation] = useState<string>("");

  const handleMakeSingleAssignment = (colId: string, fId: string) => {
    if (!colId || !fId) return;
    
    // Check if duplicate assignment exists
    const duplicate = db.Assignment.some(as => as.ObjectType === 'Column' && as.ObjectID === colId && as.FoundationID === fId);
    if (duplicate) {
      alert("العمود مربوط بالفعل بهذه القاعدة!");
      return;
    }

    // Assign column to foundation in Assignment table
    const updated = { ...db };
    updated.Assignment.push({
      FoundationID: fId,
      ObjectType: 'Column',
      ObjectID: colId
    });
    setDb(updated);
  };

  const handleCreateNewFoundationAndAssign = (colId: string, type: 'Isolated' | 'Strip' | 'Combined' | 'Raft') => {
    const fId = `FD-${type.toUpperCase()}-${colId}-${Math.floor(Math.random()*100)}`;
    const updated = { ...db };
    
    // Create master entry
    updated.Foundations.push({
      FoundationID: fId,
      FoundationType: type,
      Name: `F-${colId} (${type === 'Isolated' ? 'منفردة' : type === 'Combined' ? 'مشتركة' : type === 'Strip' ? 'مستمرة' : 'لبشة'})`,
      TopElevation: -500,
      BottomElevation: -1000,
      MaterialID: "C25_420",
      SoilPropertySet: "SP-SAND-1",
      DesignGroup: type === 'Raft' ? 'FG-RAFT' : 'FG-LIGHT',
      DrawingGroup: "DWG_F_1",
      Status: 'Design',
      UserNotes: `Created on demand for column ${colId}`
    });

    // Create Geometry Entry
    const lValue = type === 'Raft' ? 12000 : type === 'Combined' ? 3600 : type === 'Strip' ? 5000 : 1800;
    const wValue = type === 'Raft' ? 10000 : type === 'Combined' ? 1800 : type === 'Strip' ? 1200 : 1800;
    const tValue = type === 'Raft' ? 1000 : type === 'Combined' ? 600 : type === 'Strip' ? 500 : 500;
    updated.Geometry.push({
      FoundationID: fId,
      Shape: type === 'Isolated' ? 'Square' : 'Rectangular',
      Length: lValue,
      Width: wValue,
      Thickness: tValue,
      Rotation: 0,
      Area: parseFloat(((lValue * wValue) / 1000000).toFixed(3)),
      Volume: parseFloat((((lValue * wValue * tValue) / 1000000000)).toFixed(3))
    });

    // Create Soil Entry
    updated.Soil.push({
      FoundationID: fId,
      SoilPropertyID: "SP-SAND-1",
      AllowableBearing: 150,
      Ks: 18000,
      Es: 30000,
      PoissonRatio: 0.28,
      GroundwaterCondition: 'Dry'
    });

    // Create Level Entry
    updated.Levels.push({
      FoundationID: fId,
      FoundationLevel: -1000,
      ReferenceLevel: "Ground",
      StepParentID: "",
      StepHeight: 0
    });

    // Make target assignment
    updated.Assignment.push({
      FoundationID: fId,
      ObjectType: 'Column',
      ObjectID: colId
    });

    setDb(updated);
  };

  // ─── ETABS DATA IMPORT MECHANISM ───
  const [etabsInputText, setEtabsInputText] = useState<string>(
    `# ColumnID, X_m, Y_m, P_kN, Mx_kNm, My_kNm\nC11, 2.4, 1.8, 380, 24, 15\nC12, 6.2, 1.8, 450, -32, 10\nC13, 10.0, 1.8, 410, 12, -8\nC14, 2.4, 5.5, 950, 48, 30\nC15, 6.2, 5.5, 1200, 75, -45\nC16, 10.0, 5.5, 910, -15, 20`
  );

  const [importedEtabsRows, setImportedEtabsRows] = useState<any[]>([]);

  const handleParseEtabsData = () => {
    const lines = etabsInputText.split("\n");
    const results: any[] = [];
    lines.forEach(line => {
      if (line.trim().startsWith("#") || !line.trim()) return;
      const parts = line.split(",").map(p => p.trim());
      if (parts.length >= 4) {
        results.push({
          id: parts[0],
          x: parseFloat(parts[1]) || 0,
          y: parseFloat(parts[2]) || 0,
          P: parseFloat(parts[3]) || 0,
          Mx: parseFloat(parts[4]) || 0,
          My: parseFloat(parts[5]) || 0
        });
      }
    });
    setImportedEtabsRows(results);
  };

  const handleApplyEtabsImport = () => {
    if (importedEtabsRows.length === 0) {
      alert("الرجاء معالجة بيانات ETABS أولاً بالنقر على زر 'تحليل البيانات'!");
      return;
    }

    const updated = { ...db };
    importedEtabsRows.forEach(row => {
      const fId = `FD-ETABS-${row.id}`;
      // Verify if is duplicate
      if (!updated.Foundations.some(f => f.FoundationID === fId)) {
        updated.Foundations.push({
          FoundationID: fId,
          FoundationType: 'Isolated',
          Name: `FE-${row.id} (مستوردة)`,
          TopElevation: -500,
          BottomElevation: -1000,
          MaterialID: "C25_420",
          SoilPropertySet: "SP-SAND-1",
          DesignGroup: "FG-LIGHT",
          DrawingGroup: "DWG_ISO",
          Status: 'Design',
          UserNotes: `Imported from structural ETABS model coordinates [X: ${row.x}m, Y: ${row.y}m]`
        });

        // Determine sensible thickness/size from loading magnitude
        const approxSize = Math.max(1200, Math.min(3200, Math.round(Math.sqrt(row.P / 150) * 1000 / 100) * 100));
        const approxThickness = Math.max(400, Math.min(1000, Math.round((row.P / 1500) * 400 / 50) * 50));

        updated.Geometry.push({
          FoundationID: fId,
          Shape: 'Square',
          Length: approxSize,
          Width: approxSize,
          Thickness: approxThickness,
          Rotation: 0,
          Area: parseFloat(((approxSize * approxSize) / 1000000).toFixed(3)),
          Volume: parseFloat((((approxSize * approxSize * approxThickness) / 1000000000)).toFixed(3))
        });

        updated.Assignment.push({
          FoundationID: fId,
          ObjectType: 'Column',
          ObjectID: row.id
        });

        updated.Levels.push({
          FoundationID: fId,
          FoundationLevel: -1000,
          ReferenceLevel: "Ground level",
          StepParentID: "",
          StepHeight: 0
        });

        updated.Soil.push({
          FoundationID: fId,
          SoilPropertyID: "SP-SAND-1",
          AllowableBearing: 150,
          Ks: 18000,
          Es: 30000,
          PoissonRatio: 0.28,
          GroundwaterCondition: 'Dry'
        });
      }
    });

    setDb(updated);
    alert(`تم استيراد ${importedEtabsRows.length} عناصر من ETABS بنجاح، وتوليد القواعد والأبعاد الهندسية وربطها تلقائياً!`);
    setActiveWorkspaceTab("tables");
  };

  // ─── DEPENDENT MODULES STIMULATION AND ACTIONS ───
  const [activeDependentModule, setActiveDependentModule] = useState<'sizing' | 'boq' | 'detailing'>('sizing');
  const [selectedAnalysisFdId, setSelectedAnalysisFdId] = useState<string>(
    db.Foundations[0]?.FoundationID || ""
  );

  // Sync selection for analysis on load
  useEffect(() => {
    if (db.Foundations.length > 0 && !selectedAnalysisFdId) {
      setSelectedAnalysisFdId(db.Foundations[0].FoundationID);
    }
  }, [db.Foundations, selectedAnalysisFdId]);

  // Compute live analysis stress metrics based on chosen foundation in database
  const activeAnalysisMetrics = useMemo(() => {
    if (!selectedAnalysisFdId) return null;
    const fNode = queryAPI.GetFoundationByID(selectedAnalysisFdId);
    const gNode = queryAPI.GetFoundationGeometry(selectedAnalysisFdId);
    const sNode = queryAPI.GetSoilProperties(selectedAnalysisFdId);

    if (!fNode || !gNode || !sNode) return null;

    // Use query API to parse load
    const loadInfo = queryAPI.GetFoundationLoads(selectedAnalysisFdId, columns, colLoads3D);

    const length_m = gNode.Length / 1000;
    const width_m = gNode.Width / 1000;
    const thick_m = gNode.Thickness / 1000;

    const area = length_m * width_m;
    const z_mod_x = (width_m * Math.pow(length_m, 2)) / 6;
    const z_mod_y = (length_m * Math.pow(width_m, 2)) / 6;

    // Direct structural math
    const verticalPressure = loadInfo.TotalServiceLoad / area;
    const flexurePressureX = loadInfo.Mx / z_mod_x;
    const flexurePressureY = loadInfo.My / z_mod_y;

    const qmax = verticalPressure + flexurePressureX + flexurePressureY;
    const qmin = Math.max(0, verticalPressure - flexurePressureX - flexurePressureY);

    const isCompliance = qmax <= sNode.AllowableBearing;

    return {
      foundation: fNode,
      geometry: gNode,
      soil: sNode,
      loads: loadInfo,
      qmax: parseFloat(qmax.toFixed(1)),
      qmin: parseFloat(qmin.toFixed(1)),
      isCompliance,
      allowable: sNode.AllowableBearing
    };
  }, [selectedAnalysisFdId, queryAPI, columns, colLoads3D]);

  // Trigger optimal sizing feedback loop modifying Geometry Table
  const handleAutoSizingOptimization = () => {
    if (!selectedAnalysisFdId || !activeAnalysisMetrics) return;
    const { loads, soil, geometry } = activeAnalysisMetrics;

    // Optimisation Loop adjusting Width/Length in database
    let curL = geometry.Length;
    let curW = geometry.Width;
    let step = 100;
    let limit = 8000;
    const allowance = soil.AllowableBearing;

    let iterations = 0;
    let compliance = false;

    while (iterations < 50 && curL < limit) {
      const area = (curL / 1000) * (curW / 1000);
      const z_mod_x = ((curW / 1000) * Math.pow(curL / 1000, 2)) / 6;
      const z_mod_y = ((curL / 1000) * Math.pow(curW / 1000, 2)) / 6;

      const qmax = (loads.TotalServiceLoad / area) + (loads.Mx / z_mod_x) + (loads.My / z_mod_y);
      if (qmax <= allowance) {
        compliance = true;
        break;
      }
      // Expand size
      curL += step;
      curW += step;
      iterations++;
    }

    if (compliance) {
      const updated = { ...db };
      const gIdx = updated.Geometry.findIndex(g => g.FoundationID === selectedAnalysisFdId);
      if (gIdx !== -1) {
        updated.Geometry[gIdx].Length = curL;
        updated.Geometry[gIdx].Width = curW;
        updated.Geometry[gIdx].Area = parseFloat(((curL * curW) / 1000000).toFixed(3));
        updated.Geometry[gIdx].Volume = parseFloat((((curL * curW * geometry.Thickness) / 1000000000)).toFixed(3));
        
        // Mark foundation status
        const fIdx = updated.Foundations.findIndex(f => f.FoundationID === selectedAnalysisFdId);
        if (fIdx !== -1) {
          updated.Foundations[fIdx].Status = 'Design';
        }

        setDb(updated);
        alert(`تم تحسين أبعاد القاعدة تلقائياً بنجاح! الأبعاد الجديدة: ${curL}x${curW} مم بناءً على إجهاد التربة المسموح به.`);
      }
    } else {
      alert("تعذر التحسين: تجاوزت الأبعاد الحد الأقصى المسموح به دون تحقيق الآمان الجيوتقني.");
    }
  };

  // Live BOQ Cost Statistics
  const boqMetrics = useMemo(() => {
    let totalConcreteVolume = 0;
    let totalExcavation = 0;
    let totalRebarWeight = 0;

    db.Geometry.forEach(g => {
      totalConcreteVolume += g.Volume;
      // Assume excavation is slightly larger in footprint (+0.5m envelope) and 1.5m deep
      const rawFootprint = ((g.Length + 1000) / 1000) * ((g.Width + 1000) / 1000);
      totalExcavation += rawFootprint * 1.5;

      // Reinforced design estimate (avg 85kg steel / m3 of concrete)
      totalRebarWeight += g.Volume * 85;
    });

    const concreteCost = totalConcreteVolume * 450; // $ per m3 standard
    const steelCost = (totalRebarWeight / 1000) * 1100; // $ per ton standard
    const excavationCost = totalExcavation * 35; // $ per m3

    return {
      concreteVol: parseFloat(totalConcreteVolume.toFixed(2)),
      excavationVol: parseFloat(totalExcavation.toFixed(2)),
      steelTons: parseFloat((totalRebarWeight / 1000).toFixed(3)),
      concreteCost: Math.round(concreteCost),
      steelCost: Math.round(steelCost),
      excavationCost: Math.round(excavationCost),
      totalCost: Math.round(concreteCost + steelCost + excavationCost)
    };
  }, [db]);


  return (
    <div className="space-y-6 text-slate-800" dir="rtl" id="foundation-db-container">
      {/* ── HEADER & QUICK STATS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-rose-500" />
            محرك ربط القواعد وقاعدة البيانات الإنشائية
            <span className="text-xs font-mono font-normal bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">
              Single Source of Truth
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            إدارة متكاملة بأسلوب جداول قواعد البيانات الرقمية للربط الدقيق بين الأعمدة والقواعد، التحقق الجيوتقني، واستيراد ETABS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDatabase}
            className="text-slate-500 border-slate-200 h-9 font-sans"
          >
            <RotateCcw className="h-4 w-4 ml-1.5" />
            تهيئة النظام الافتراضي
          </Button>
          <Button
            onClick={handleAutoFixIntegrity}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm h-9 font-sans"
          >
            <ShieldCheck className="h-4 w-4 ml-1.5" />
            تحقق وإصلاح تلقائي
          </Button>
        </div>
      </div>

      {/* QUICK METRIC METADATA BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-medium">إجمالي القواعد المحددة</span>
          <span className="text-xl font-bold text-slate-900 font-mono block mt-1">
            {db.Foundations.length} <span className="text-xs font-normal text-slate-400">قواعد</span>
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-medium">عناصر الربط (العمومية)</span>
          <span className="text-xl font-bold text-slate-900 font-mono block mt-1">
            {db.Assignment.length} <span className="text-xs font-normal text-slate-400">علاقات</span>
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-medium">سلامة قاعدة البيانات</span>
          <span className="mt-1 block">
            {validationErrors.length === 0 ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-xs border-transparent hover:bg-emerald-100 flex items-center w-fit gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 ml-0.5" />
                سليمة تماماً
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 text-xs border-transparent hover:bg-amber-100 flex items-center w-fit gap-1">
                <AlertTriangle className="h-3.5 w-3.5 ml-0.5" />
                تنبيهات ({validationErrors.length})
              </Badge>
            )}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-medium">إجمالي تكلفة النظام ($)</span>
          <span className="text-xl font-bold text-slate-900 font-mono block mt-1">
            ${boqMetrics.totalCost.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── MAIN WORKSPACE SUBTABS ── */}
      <Tabs
        value={activeWorkspaceTab}
        onValueChange={(v: any) => setActiveWorkspaceTab(v)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 md:grid-cols-6 h-11 bg-slate-100/80 p-1 rounded-xl mb-4 text-xs md:text-sm">
          <TabsTrigger value="tables" className="rounded-lg flex items-center gap-1.5 py-1.5">
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            جداول البيانات (Tables)
          </TabsTrigger>
          <TabsTrigger value="assignment" className="rounded-lg flex items-center gap-1.5 py-1.5">
            <Link2 className="h-4 w-4 text-slate-500" />
            محرك الربط (Assignment)
          </TabsTrigger>
          <TabsTrigger value="etabs" className="rounded-lg flex items-center gap-1.5 py-1.5">
            <Upload className="h-4 w-4 text-slate-500" />
            استيراد ETABS
          </TabsTrigger>
          <TabsTrigger value="validation" className="rounded-lg flex items-center gap-1.5 py-1.5">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            فحص التكامل (Validation)
          </TabsTrigger>
          <TabsTrigger value="api" className="rounded-lg flex items-center gap-1.5 py-1.5">
            <Terminal className="h-4 w-4 text-slate-500" />
            مستكشف برمجيات API
          </TabsTrigger>
          <TabsTrigger value="dependent" className="rounded-lg flex items-center gap-1.5 py-1.5">
            <Cpu className="h-4 w-4 text-slate-500" />
            الموديولات التابعة
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TABS CONTENT: 1. NORMALIZED TABLES VIEWER                           */}
        {/* ==================================================================== */}
        <TabsContent value="tables">
          <Card className="border-slate-100/80 shadow-sm">
            <CardHeader className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50">
              <div>
                <CardTitle className="text-md font-bold flex items-center gap-2 text-slate-800">
                  <Database className="h-5 w-5 text-indigo-500" />
                  مستعرض حقول قاعدة البيانات العلائقية للأساسات
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  مستوحى من جداول SQL التأسيسية. التعديلات المباشرة هنا تنعكس فوراً وتعد المصدر الوحيد للقيم.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="بحث في الحقول..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9 h-9 w-44 font-sans text-xs bg-slate-50 border-slate-200"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddField(activeTable)}
                  className="h-9 border-slate-200 text-slate-600 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة سجل جديد
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Inner relational schemas */}
              <div className="bg-slate-50/50 px-4 py-2 flex flex-wrap gap-2 border-b border-slate-50">
                <button
                  onClick={() => { setActiveTable("Foundations"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Foundations"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundations (القواعد الأساسية)
                </button>
                <button
                  onClick={() => { setActiveTable("Geometry"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Geometry"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundation Geometry (أبعاد الجسيمات)
                </button>
                <button
                  onClick={() => { setActiveTable("Assignment"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Assignment"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundation Assignment (جدول الربط والتنسيب)
                </button>
                <button
                  onClick={() => { setActiveTable("Levels"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Levels"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundation Levels (مناسيب وارتفاع التأسيس)
                </button>
                <button
                  onClick={() => { setActiveTable("Types"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Types"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundation Types (أنواع القواعد)
                </button>
                <button
                  onClick={() => { setActiveTable("Groups"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Groups"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundation Groups (مجموعات التصميم)
                </button>
                <button
                  onClick={() => { setActiveTable("Soil"); setSearchTerm(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                    activeTable === "Soil"
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Foundation Soil Parameters (ربط التربة)
                </button>
              </div>

              {/* RENDER DYNAMIC RELATIONAL SPREADSHEETS */}
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  {/* --- Foundations Master Sheet --- */}
                  {activeTable === "Foundations" && (
                    <>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-100">
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">FoundationID</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">المسمى (Name)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">النوع (Type)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">منسوب السطح (TopElev)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">منسوب القاع (BotElev)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">مجموعة التربة</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">حالة التصميم</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">ملاحظات</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold text-left">خيارات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {db.Foundations.filter(f =>
                          [f.FoundationID, f.Name, f.FoundationType, f.UserNotes].some(str =>
                            str.toString().toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        ).map((row) => (
                          <TableRow key={row.FoundationID} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <TableCell className="font-mono text-[11px] text-slate-500 font-medium">{row.FoundationID}</TableCell>
                            <TableCell>
                              <input
                                value={row.Name}
                                onChange={(e) => handleUpdateField("Foundations", "FoundationID", row.FoundationID, "Name", e.target.value)}
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-semibold"
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                value={row.FoundationType}
                                onChange={(e) => handleUpdateField("Foundations", "FoundationID", row.FoundationID, "FoundationType", e.target.value)}
                                className="bg-transparent border-0 focus:ring-0 p-0 text-xs text-slate-600 font-sans"
                              >
                                <option value="Isolated">Isolated Footing</option>
                                <option value="Strip">Strip Footing</option>
                                <option value="Combined">Combined Footing</option>
                                <option value="Raft">Raft Foundation</option>
                              </select>
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.TopElevation}
                                onChange={(e) => handleUpdateField("Foundations", "FoundationID", row.FoundationID, "TopElevation", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.BottomElevation}
                                onChange={(e) => handleUpdateField("Foundations", "FoundationID", row.FoundationID, "BottomElevation", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">{row.SoilPropertySet}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] uppercase border-transparent hover:opacity-90 ${
                                row.Status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                                row.Status === "Pending" ? "bg-slate-100 text-slate-800" : "bg-indigo-100 text-indigo-800"
                              }`}>
                                {row.Status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate text-xs text-slate-400 font-sans">{row.UserNotes || "-"}</TableCell>
                            <TableCell className="text-left">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => handleDeleteRow("Foundations", row.FoundationID)}
                                className="text-rose-500 hover:text-rose-600 h-7 w-7 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </>
                  )}

                  {/* --- Foundation Geometry Sheet --- */}
                  {activeTable === "Geometry" && (
                    <>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-100">
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">FoundationID</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">الشكل الهندسي (Shape)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">الطول L (mm)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">العرض W (mm)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">السماكة T (mm)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">المساحة Area (m²)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">الحجم Volume (m³)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">الدوران Angle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {db.Geometry.filter(g =>
                          g.FoundationID.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((row) => (
                          <TableRow key={row.FoundationID} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <TableCell className="font-mono text-[11px] text-slate-500 font-medium">{row.FoundationID}</TableCell>
                            <TableCell className="text-xs">{row.Shape}</TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.Length}
                                onChange={(e) => handleUpdateField("Geometry", "FoundationID", row.FoundationID, "Length", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.Width}
                                onChange={(e) => handleUpdateField("Geometry", "FoundationID", row.FoundationID, "Width", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.Thickness}
                                onChange={(e) => handleUpdateField("Geometry", "FoundationID", row.FoundationID, "Thickness", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-slate-600">{row.Area} m²</TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-slate-600">{row.Volume} m³</TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.Rotation}
                                onChange={(e) => handleUpdateField("Geometry", "FoundationID", row.FoundationID, "Rotation", e.target.value)}
                                className="w-12 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </>
                  )}

                  {/* --- Foundation Assignment Sheet --- */}
                  {activeTable === "Assignment" && (
                    <>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-100">
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">FoundationID</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">نوع العنصر المربوط (ObjectType)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">معرف العنصر (ObjectID)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold text-left">خيارات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {db.Assignment.filter(as =>
                          [as.FoundationID, as.ObjectType, as.ObjectID].some(str =>
                            str.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        ).map((row, i) => (
                          <TableRow key={`as-${row.FoundationID}-${row.ObjectID}-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <TableCell className="font-mono text-[11px] text-slate-500 font-medium">{row.FoundationID}</TableCell>
                            <TableCell className="text-xs">{row.ObjectType}</TableCell>
                            <TableCell className="font-mono text-xs font-bold text-slate-700">{row.ObjectID}</TableCell>
                            <TableCell className="text-left">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => handleDeleteRow("Assignment", row.FoundationID, row.ObjectID)}
                                className="text-rose-500 hover:text-rose-600 h-7 w-7 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </>
                  )}

                  {/* --- Soil Parameters Sheet --- */}
                  {activeTable === "Soil" && (
                    <>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-100">
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">FoundationID</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">معرف التربة (SoilPropertyID)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">قوة التحمل المسموحة Qall (kN/m²)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">معامل رد الفعل Ks (kN/m³)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">معامل المرونة Es (kN/m²)</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">نسبة بواسون</TableHead>
                          <TableHead className="font-sans text-xs text-slate-500 font-semibold">المياه الجوفية (Water)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {db.Soil.filter(s =>
                          s.FoundationID.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((row) => (
                          <TableRow key={row.FoundationID} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <TableCell className="font-mono text-[11px] text-slate-500 font-medium">{row.FoundationID}</TableCell>
                            <TableCell className="text-xs text-slate-500">{row.SoilPropertyID}</TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.AllowableBearing}
                                onChange={(e) => handleUpdateField("Soil", "FoundationID", row.FoundationID, "AllowableBearing", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono font-semibold"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.Ks}
                                onChange={(e) => handleUpdateField("Soil", "FoundationID", row.FoundationID, "Ks", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.Es}
                                onChange={(e) => handleUpdateField("Soil", "FoundationID", row.FoundationID, "Es", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="number"
                                value={row.PoissonRatio}
                                onChange={(e) => handleUpdateField("Soil", "FoundationID", row.FoundationID, "PoissonRatio", e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent focus:border-rose-400 focus:ring-0 p-0 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                value={row.GroundwaterCondition}
                                onChange={(e) => handleUpdateField("Soil", "FoundationID", row.FoundationID, "GroundwaterCondition", e.target.value)}
                                className="bg-transparent border-0 focus:ring-0 p-0 text-xs text-slate-500 font-sans"
                              >
                                <option value="Dry">Dry</option>
                                <option value="Saturated">Saturated</option>
                                <option value="Below Footing">Below Footing</option>
                              </select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </>
                  )}

                  {/* --- Backup Fallbacks (Levels, Types, Groups) --- */}
                  {!["Foundations", "Geometry", "Assignment", "Soil"].includes(activeTable) && (
                    <div className="p-10 text-center text-slate-400 text-xs">
                      المستند معروض كجدول للقراءة فقط في هذا الإصدار لتعريفات Group و Levels الثابتة. يرجى التعديل من جداول القواعد الأساسية والأبعاد.
                    </div>
                  )}
                </Table>
              </div>
            </CardContent>
            <CardFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>جميع التغييرات تحفظ تلقائياً في المستعرض المحلي.</span>
              <span className="font-mono">إجمالي الصفوف المعروضة: {db[activeTable]?.length} صفوف</span>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TABS CONTENT: 2. INTERACTIVE ASSIGNMENT ENGINE CLIENT                */}
        {/* ==================================================================== */}
        <TabsContent value="assignment" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left controller: Make manual mapping relationships */}
            <Card className="border-slate-100 lg:col-span-1 shadow-sm">
              <CardHeader className="p-5 border-b border-b-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-1 text-slate-800">
                  <Link2 className="h-4 w-4 text-emerald-500" />
                  محور ربط الأعمدة النشط
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  اختر أي عمود إنشائي واربطه مباشرة بقاعدة موجودة أو قم بتوليد قاعدة مخصصة له بمقاسات مناسبة.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">العمود الإنشائي المستهدف:</label>
                  <select
                    value={selectedAssignmentCol}
                    onChange={(e) => setSelectedAssignmentCol(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="">-- اختر عموداً --</option>
                    {columns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.id} (Location: X={c.x}m, Y={c.y}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">ربطه بقاعدة مسلحة موجودة:</label>
                  <select
                    value={selectedTargetFoundation}
                    onChange={(e) => setSelectedTargetFoundation(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="">-- اختر قاعدة من الجدول --</option>
                    {db.Foundations.map(f => (
                      <option key={f.FoundationID} value={f.FoundationID}>
                        {f.Name} (ID: {f.FoundationID}) - {f.FoundationType}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={() => handleMakeSingleAssignment(selectedAssignmentCol, selectedTargetFoundation)}
                  disabled={!selectedAssignmentCol || !selectedTargetFoundation}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-lg text-xs font-sans"
                >
                  <Link2 className="h-3.5 w-3.5 ml-1.5" />
                  ربط العمود بالقاعدة المحددة
                </Button>

                <div className="h-px bg-slate-100 my-4" />

                <div className="space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">أو إنشاء قاعدة جديدة للعمود المختار فورا:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleCreateNewFoundationAndAssign(selectedAssignmentCol, 'Isolated')}
                      disabled={!selectedAssignmentCol}
                      className="text-xs border-slate-200 text-slate-600 h-9 font-sans"
                    >
                      منفردة Isolated
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleCreateNewFoundationAndAssign(selectedAssignmentCol, 'Combined')}
                      disabled={!selectedAssignmentCol}
                      className="text-xs border-slate-200 text-slate-600 h-9 font-sans"
                    >
                      مشتركة Combined
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleCreateNewFoundationAndAssign(selectedAssignmentCol, 'Strip')}
                      disabled={!selectedAssignmentCol}
                      className="text-xs border-slate-200 text-slate-600 h-9 font-sans"
                    >
                      مستمرة Strip
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleCreateNewFoundationAndAssign(selectedAssignmentCol, 'Raft')}
                      disabled={!selectedAssignmentCol}
                      className="text-xs border-slate-200 text-slate-600 h-9 font-sans"
                    >
                      لبشة Raft
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right details sheet: Current Assignment Tree and mappings lookup */}
            <Card className="border-slate-100 lg:col-span-2 shadow-sm">
              <CardHeader className="p-5 border-b border-b-slate-50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-1 text-slate-800">
                    <Layers className="h-4 w-4 text-rose-500" />
                    شجرة توافق وربط عناصر الأعمدة بالأساسات المنجزة
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-1">
                    يوضح العلاقات الحالية المسجلة في جدول العلاقات `Assignment`.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-b border-slate-100">
                      <TableHead className="font-sans text-xs text-slate-500 font-semibold">مسمى القاعدة</TableHead>
                      <TableHead className="font-sans text-xs text-slate-500 font-semibold">نوع التأسيس</TableHead>
                      <TableHead className="font-sans text-xs text-slate-500 font-semibold">الأعمدة المدعومة (Supported Columns)</TableHead>
                      <TableHead className="font-sans text-xs text-slate-500 font-semibold">موقع المركز (X, Y) م</TableHead>
                      <TableHead className="font-sans text-xs text-slate-500 font-semibold text-left">خيارات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {db.Foundations.map((f) => {
                      const assigns = db.Assignment.filter(a => a.FoundationID === f.FoundationID);
                      const columnsText = assigns.map(a => a.ObjectID).join(", ") || "-";

                      // Resolve coordinates if columns exist
                      let avgX = 0;
                      let avgY = 0;
                      let count = 0;
                      assigns.forEach(a => {
                        const col = columns.find(c => c.id === a.ObjectID);
                        if (col) {
                          avgX += col.x;
                          avgY += col.y;
                          count++;
                        }
                      });

                      const xText = count > 0 ? (avgX/count).toFixed(2) : "-";
                      const yText = count > 0 ? (avgY/count).toFixed(2) : "-";

                      return (
                        <TableRow key={`tree-${f.FoundationID}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-800 text-xs">{f.Name}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] uppercase border-transparent ${
                              f.FoundationType === "Isolated" ? "bg-amber-100 text-amber-800" :
                              f.FoundationType === "Combined" ? "bg-cyan-100 text-cyan-800" :
                              f.FoundationType === "Strip" ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"
                            }`}>
                              {f.FoundationType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-700">
                              {columnsText}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {count > 0 ? `${xText}, ${yText}` : "غير محدد"}
                          </TableCell>
                          <TableCell className="text-left">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                // Clear all assignments for this foundation
                                const updated = { ...db };
                                updated.Assignment = updated.Assignment.filter(a => a.FoundationID !== f.FoundationID);
                                setDb(updated);
                              }}
                              className="text-slate-400 hover:text-slate-600 h-7 text-xs font-sans px-2"
                            >
                              قطع الربط (Reset)
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TABS CONTENT: 3. ETABS DATA COMPREHENSIVE IMPORT                     */}
        {/* ==================================================================== */}
        <TabsContent value="etabs" className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="p-5 border-b border-slate-50">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Upload className="h-5 w-5 text-indigo-500" />
                استيراد أبعاد وأحمال الأعمدة والجدران من ETABS
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                الصق مخرجات جدول الإحداثيات وردود الأفعال المصدرة من ETABS مباشرة لترميز وتغذية قاعدة بيانات الأساسات تلقائياً.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left side: CSV syntax input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>بيانات CSV لأعمدة ETABS:</span>
                    <span className="text-slate-400 font-mono">Format: ID, X, Y, P, Mx, My</span>
                  </div>
                  <textarea
                    rows={8}
                    value={etabsInputText}
                    onChange={(e) => setEtabsInputText(e.target.value)}
                    className="w-full font-mono text-xs p-3 bg-slate-900 text-emerald-400 rounded-lg border-0 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleParseEtabsData}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg text-xs font-sans"
                    >
                      <Play className="h-3.5 w-3.5 ml-1" />
                      تحليل وقراءة البيانات مستندياً
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEtabsInputText(
                        `# ColumnID, X_m, Y_m, P_kN, Mx_kNm, My_kNm\nC1, 1.5, 2.0, 450, 20, 10\nC2, 4.5, 2.0, 600, 30, 15\nC3, 7.5, 2.0, 520, -10, 8\nC4, 1.5, 6.0, 1100, 50, 30\nC5, 4.5, 6.0, 1450, 80, -40\nC6, 7.5, 6.0, 980, -20, 25`
                      )}
                      className="border-slate-200 text-slate-600 h-9 px-3 rounded-lg text-xs font-sans"
                    >
                      تعبئة نموذج اختبار
                    </Button>
                  </div>
                </div>

                {/* Right side: Processed review grid */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 block">معاينة العناصر المُستخرجة قبل الإدراج:</span>
                  {importedEtabsRows.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-sans">
                      انقر على زر 'تحليل البيانات' لمعاينة جدول الأعمدة.
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto border border-slate-100 rounded-lg bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                          <TableRow className="border-b border-slate-100">
                            <TableHead className="font-sans text-[11px] p-2 text-slate-500">العنصر</TableHead>
                            <TableHead className="font-sans text-[11px] p-2 text-slate-500">موقع X (m)</TableHead>
                            <TableHead className="font-sans text-[11px] p-2 text-slate-500">موقع Y (m)</TableHead>
                            <TableHead className="font-sans text-[11px] p-2 text-slate-500">الحمل الخدمي P (kN)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importedEtabsRows.map((row, idx) => (
                            <TableRow key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                              <TableCell className="font-mono text-xs font-bold p-2">{row.id}</TableCell>
                              <TableCell className="font-mono text-xs p-2">{row.x}</TableCell>
                              <TableCell className="font-mono text-xs p-2">{row.y}</TableCell>
                              <TableCell className="font-mono text-xs font-semibold p-2 text-rose-600">{row.P} kN</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      onClick={handleApplyEtabsImport}
                      disabled={importedEtabsRows.length === 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 rounded-lg text-xs font-sans"
                    >
                      <CheckCircle2 className="h-4 w-4 ml-1.5" />
                      توليد القواعد والربط في الجداول فوراً
                    </Button>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TABS CONTENT: 4. INTEGRITY VALIDATION ENGINE REPORTS                 */}
        {/* ==================================================================== */}
        <TabsContent value="validation" className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="p-5 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    محرك التحقق البرمجي التلقائي لتكامل وتناسق البيانات
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-1">
                    يفحص التطابق الهندسي والإنشائي لتحديد الثغرات والأخطاء في جداول قاعدة البيانات.
                  </CardDescription>
                </div>
                <Badge className={`text-xs py-1 px-2.5 rounded-full border-transparent ${
                  validationErrors.length === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {validationErrors.length === 0 ? "متوافق ومطابق كلياً" : `${validationErrors.length} قضايا تتطلب المراجعة`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {validationErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
                  <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">نظام البيانات والأساسات متكامل تماماً!</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    كل الأعمدة مربوطة بقواعد مناسبة، ولا توجد علاقات ربط مكررة أو مفقودة للخصائص الهندسية أو الميكانيكية للتربة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {validationErrors.map((error) => (
                      <div
                        key={error.id}
                        className={`flex items-start gap-3 p-3.5 border rounded-xl ${
                          error.severity === "Error"
                            ? "bg-rose-50/50 border-rose-100 text-rose-900"
                            : "bg-amber-50/50 border-amber-100 text-amber-950"
                        }`}
                      >
                        <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${
                          error.severity === "Error" ? "text-rose-500" : "text-amber-500"
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">{error.arMessage}</span>
                            <Badge className={`text-[9px] uppercase hover:opacity-90 ${
                              error.severity === "Error" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {error.severity}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{error.message}</p>
                          <span className="text-[10px] text-slate-400/80 block mt-1 font-sans">
                            Target Element Path ID: <span className="font-mono bg-white border border-slate-100/10 px-1 py-0.5 rounded text-slate-500">{error.targetID}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">تريد معالجة هذه القضايا بضغطة زر؟</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        سيقوم النظام بتوليد قواعد منفردة وحسابات أبعاد هندسية وربط التربة تلقائياً لجميع القضايا المكتشفة.
                      </p>
                    </div>
                    <Button
                      onClick={handleAutoFixIntegrity}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 px-4 rounded-lg font-sans"
                    >
                      تنفيذ الإصلاح والربط التلقائي
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TABS CONTENT: 5. QUERY API DEVELOPER INTERACTIVE PLAYGROUND          */}
        {/* ==================================================================== */}
        <TabsContent value="api" className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="p-5 border-b border-indigo-50/80">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                <FileCode2 className="h-5 w-5 text-rose-500" />
                بيئة اختبار واستكشاف حقول الاستعلام البرمجي (Query API Console)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                جميع الموديولات الهندسية اللاحقة تقرأ وتكتب حصرياً وببروتوكول موحد من هذه الدوال والواجهات الإنشائية البرمجية.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left controls: Select criteria */}
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <span className="text-xs font-bold text-slate-600 block">مرشحات ومعطيات الاستعلام:</span>
                    
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">معرف القاعدة المطلوبة FoundationID:</label>
                      <select
                        value={apiSelectedFoundation}
                        onChange={(e) => setApiSelectedFoundation(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none"
                      >
                        {db.Foundations.map(f => (
                          <option key={f.FoundationID} value={f.FoundationID}>{f.Name} ({f.FoundationType})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">دالة الاستعلام البرمجية API Method:</label>
                      <select
                        value={apiSelectedMethod}
                        onChange={(e) => setApiSelectedMethod(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none text-slate-800"
                      >
                        <option value="GetFoundationByID">GetFoundationByID() - جلب سجل قاعدة البيانات</option>
                        <option value="GetFoundationGeometry">GetFoundationGeometry() - جلب الأبعاد الهندسية</option>
                        <option value="GetSupportedObjects">GetSupportedObjects() - جلب علاقات تنسيب الأعمدة/الجدران</option>
                        <option value="GetSoilProperties">GetSoilProperties() - جلب معامل وبارامترات ميكانيكا التربة</option>
                        <option value="GetLevels">GetLevels() - جلب مناسيب التأسيس وارتفاع الخطوات</option>
                        <option value="GetFoundationLoads">GetFoundationLoads() - حساب الإجهادات الخدمية والقصوى المركبة</option>
                      </select>
                    </div>

                    <div className="pt-1.5">
                      <Button
                        onClick={runApiQuery}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-lg text-xs font-sans"
                      >
                        <Play className="h-3.5 w-3.5 ml-1.5" />
                        تنفيذ الاستعلام البرمجي (Call API)
                      </Button>
                    </div>
                  </div>

                  {/* Dev-Docs guidelines */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-600 block">واجهات الاستدعاء السليمة للموديولات اللاحقة:</span>
                    <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[10px] rounded-lg overflow-x-auto">
{`// استدعاء أحمال القاعدة الـ Combined من الجداول
const loadStats = queryAPI.GetFoundationLoads("FD-COMB-01", columns);
console.log(loadStats.TotalServiceLoad); // -> 730 kN

// استعلام أبعاد التأسيس لإعادة الرسم ثنائي الأبعاد
const geo = queryAPI.GetFoundationGeometry(id);
const volume = geo.Length * geo.Width * geo.Thickness;`}
                    </pre>
                  </div>
                </div>

                {/* Right console output */}
                <div className="space-y-2 flex flex-col h-full">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>مجموع مخرجات الاستعلام الرقمي (JSON Response):</span>
                    <span className="text-indigo-600 font-medium">Status: 200 OK</span>
                  </div>
                  <pre className="flex-1 p-3.5 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg overflow-auto max-h-[290px]">
                    {apiOutput}
                  </pre>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TABS CONTENT: 6. DEPENDENT MODULES STIMULATION DEMOS                 */}
        {/* ==================================================================== */}
        <TabsContent value="dependent" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left sidebar: Select dependent modules */}
            <Card className="border-slate-100 lg:col-span-1 shadow-sm h-fit">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-bold text-slate-400 block px-2 mb-3">اختر الموديول الهندسي المستهلك للداتا:</span>
                
                <button
                  onClick={() => setActiveDependentModule("sizing")}
                  className={`w-full text-right text-xs p-3 rounded-xl flex items-center justify-between transition ${
                    activeDependentModule === "sizing" 
                      ? "bg-rose-50 text-rose-700 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Scale className="h-4 w-4" />
                    المطابقة وتحسين الأبعاد
                  </span>
                  <Badge className="bg-slate-100 text-slate-600 text-[10px] font-normal font-sans">Analysis</Badge>
                </button>

                <button
                  onClick={() => setActiveDependentModule("boq")}
                  className={`w-full text-right text-xs p-3 rounded-xl flex items-center justify-between transition ${
                    activeDependentModule === "boq" 
                      ? "bg-rose-50 text-rose-700 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Coins className="h-4 w-4" />
                    تكاليف وجداول الكميات BOQ
                  </span>
                  <Badge className="bg-slate-100 text-slate-600 text-[10px] font-normal font-sans">Financial</Badge>
                </button>

                <button
                  onClick={() => setActiveDependentModule("detailing")}
                  className={`w-full text-right text-xs p-3 rounded-xl flex items-center justify-between transition ${
                    activeDependentModule === "detailing" 
                      ? "bg-rose-50 text-rose-700 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Construction className="h-4 w-4" />
                    تفاصيل ومخططات التسليح
                  </span>
                  <Badge className="bg-slate-100 text-slate-600 text-[10px] font-normal font-sans">Drafting</Badge>
                </button>
              </CardContent>
            </Card>

            {/* Right container: Active module representation layout */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* --- SUB-VIEW A: STRESS COMPLIANCE AND DYNAMIC OPTIMISATION LOOP --- */}
              {activeDependentModule === "sizing" && (
                <Card className="border-slate-150 shadow-sm">
                  <CardHeader className="p-5 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                        <Scale className="h-5 w-5 text-indigo-500" />
                        حساب إجهادات التربة والتحسين الأمامي التلقائي للتأسيس
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 mt-0.5">
                        يقرأ الأحمال من جدول الربط ويطابق إجهادات التربة، ثم يقوم بتحديث جدول الأبعاد Geometry تلقائياً عند طلب التحسين.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedAnalysisFdId}
                        onChange={(e) => setSelectedAnalysisFdId(e.target.value)}
                        className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none"
                      >
                        {db.Foundations.map(f => (
                          <option key={f.FoundationID} value={f.FoundationID}>{f.Name}</option>
                        ))}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {activeAnalysisMetrics ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                            <span className="text-xs text-slate-400">مجموع الأحمال الخدمية P</span>
                            <span className="text-lg font-bold text-indigo-950 mt-1 font-mono">{activeAnalysisMetrics.loads.TotalServiceLoad} kN</span>
                          </div>
                          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                            <span className="text-xs text-slate-400">أقصى إجهاد واقع للتربة Qmax</span>
                            <span className="text-lg font-bold text-slate-900 mt-1 font-mono flex items-center gap-2">
                              {activeAnalysisMetrics.qmax} kN/m²
                              <span className="text-xs font-normal text-slate-400">vs {activeAnalysisMetrics.allowable}</span>
                            </span>
                          </div>
                          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                            <span className="text-xs text-slate-400">حالة المطابقة الإنشائية</span>
                            <span className="mt-1">
                              {activeAnalysisMetrics.isCompliance ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] hover:bg-emerald-100 border-transparent">✓ آمنة وجيوتقنية</Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-800 text-[10px] hover:bg-rose-100 border-transparent">⚠️ تجاوز القدرة المسموحة! (حرجة)</Badge>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Bearing visual graph mockup */}
                        <div className="border border-slate-100 p-4 rounded-xl bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span>توزيع إجهادات التربة على طول خط القاعدة:</span>
                            <span className="font-mono">Qmin: {activeAnalysisMetrics.qmin} | Qmax: {activeAnalysisMetrics.qmax} kN/m²</span>
                          </div>
                          {/* Visual CSS diagram */}
                          <div className="w-full bg-slate-200 h-6 rounded flex items-center overflow-hidden font-mono text-[10px] p-0.5 text-center text-white font-bold">
                            <div className="bg-rose-500 h-full flex items-center justify-center transition-all" style={{ width: `${Math.min(100, (activeAnalysisMetrics.qmax / activeAnalysisMetrics.allowable) * 100)}%` }}>
                              {Math.round((activeAnalysisMetrics.qmax / activeAnalysisMetrics.allowable) * 100)}% Stress
                            </div>
                            <div className="bg-slate-300 flex-1 h-full" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100/40 rounded-xl">
                          <div>
                            <span className="text-xs font-bold text-indigo-950 block">هل تريد تشغيل موديول التحسين التلقائي (Auto-Sizing)؟</span>
                            <span className="text-[11px] text-indigo-500 mt-0.5 block">
                              سيقوم النظام بحساب أقل أبعاد (Length/Width) آمنة لإجهاد التربة، وتحديث جدول الهندسة مباشرة في السورس.
                            </span>
                          </div>
                          <Button
                            onClick={handleAutoSizingOptimization}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 rounded-lg font-sans shadow-sm"
                          >
                            بدء دورة التحسين (Optimize)
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-10 text-center text-slate-400 text-xs">من فضلك اختر قاعدة صالحة في الحاوية بالأعلى.</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* --- SUB-VIEW B: BILL OF QUANTITIES AND FINANCIAL MODELING --- */}
              {activeDependentModule === "boq" && (
                <Card className="border-slate-150 shadow-sm">
                  <CardHeader className="p-5 border-b border-slate-50">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                      <Coins className="h-5 w-5 text-amber-500" />
                      موديول تسعير وحساب كميات الأساسات الرقمي (Takeoff Quantity Takeoff)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      يقرأ الكميات والأوزان وحجم الحفر تلقائياً بمجرد إدراك أو تحديث سماكات أو مساحات جدول الجيومتري Geometry والتشغيل الفردي.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Cost metrics and specifications overview */}
                      <div className="space-y-4">
                        <span className="text-xs font-bold text-slate-600 block border-b border-slate-100 pb-1.5">حجم وتفاصيل الكميات الكلية:</span>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">حجم الخرسانة المسلحة الكلي:</span>
                          <span className="font-mono font-bold text-slate-800">{boqMetrics.concreteVol} m³</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">حجم أعمال الحفر والتربة المتوقع:</span>
                          <span className="font-mono font-bold text-slate-800">{boqMetrics.excavationVol} m³</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">وزن حديد التسليح التقريبي:</span>
                          <span className="font-mono font-bold text-slate-800">{boqMetrics.steelTons} طن</span>
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-600 block">أسعار بنود التنفيذ التأسيسية المفترضة:</span>
                          <span className="text-[10px] text-slate-400 block">• الخرسانة المسلحة: $450/m³ | • الحديد المسلح: $1,100/Ton | • أعمال الحفر: $35/m³</span>
                        </div>
                      </div>

                      {/* Financial values card graphs */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-600 block">إجمالي كلفة المواد والتشييد المقدرة للأساسات:</span>
                          <span className="text-3xl font-black text-rose-600 block mt-2 font-mono">
                            ${boqMetrics.totalCost.toLocaleString()}
                          </span>
                        </div>

                        {/* Quick visual bar percentage breakdowns */}
                        <div className="space-y-2 mt-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                              <span>خرسانة مسلحة Concrete: ${boqMetrics.concreteCost.toLocaleString()}</span>
                              <span>{Math.round((boqMetrics.concreteCost/boqMetrics.totalCost)*100)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full" style={{ width: `${(boqMetrics.concreteCost/boqMetrics.totalCost)*100}%` }} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                              <span>حديد تسليح Rebar: ${boqMetrics.steelCost.toLocaleString()}</span>
                              <span>{Math.round((boqMetrics.steelCost/boqMetrics.totalCost)*100)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full" style={{ width: `${(boqMetrics.steelCost/boqMetrics.totalCost)*100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              )}

              {/* --- SUB-VIEW C: REINFORCED SCHEDULING AND DRAFTING ELEVATIONS --- */}
              {activeDependentModule === "detailing" && (
                <Card className="border-slate-150 shadow-sm">
                  <CardHeader className="p-5 border-b border-slate-50">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                      <Construction className="h-5 w-5 text-rose-500" />
                      تفاصيل حديد التسليح ومخططات التشييد (Drafting and Detailing)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      يستكشف الخصائص من جدول القواعد وجدول المجموعات Group ليرسم تلقائياً المقطع الإنشائي والتسليحي المعتمد.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row gap-6">
                      
                      {/* Left side text notes */}
                      <div className="flex-1 space-y-3">
                        <span className="text-xs font-bold text-slate-600 block">ضوابط المقطع وفقاً لعلامات Group الجدولية:</span>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-500 space-y-2 font-sans">
                          <div>
                            <span className="text-slate-400 block">المواصفة التصميمية الحاكمة:</span>
                            <span className="font-semibold text-slate-800 font-mono">ACI 318-19 (معهد الخرسانة الأمريكي)</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">الغطاء الخرساني الصافي المعتمد:</span>
                            <span className="font-semibold text-slate-800 font-mono">75 mm (جهد تماس مباشر مع التربة)</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">تسليح القاعدة الإرشادي:</span>
                            <span className="font-semibold text-slate-800 font-mono">13Φ14mm @ 150mm لكل اتجاه</span>
                          </div>
                        </div>
                      </div>

                      {/* Right side rendering of 2D SVG Section detailing */}
                      <div className="flex-1 flex justify-center bg-slate-900 rounded-xl p-4 border border-slate-950/40">
                        <svg width="220" height="150" viewBox="0 0 220 150" className="mx-auto select-none">
                          {/* Footing Outline concrete */}
                          <rect x="20" y="70" width="180" height="50" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                          {/* Column stub */}
                          <rect x="95" y="10" width="30" height="60" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
                          
                          {/* Soil indicator lines under footing */}
                          <line x1="20" y1="125" x2="30" y2="135" stroke="#4a5568" strokeWidth="1" />
                          <line x1="60" y1="125" x2="70" y2="135" stroke="#4a5568" strokeWidth="1" />
                          <line x1="100" y1="125" x2="110" y2="135" stroke="#4a5568" strokeWidth="1" />
                          <line x1="140" y1="125" x2="150" y2="135" stroke="#4a5568" strokeWidth="1" />
                          <line x1="180" y1="125" x2="190" y2="135" stroke="#4a5568" strokeWidth="1" />

                          {/* Rebar lines - bottom mesh bending up as standard hooks L */}
                          <path d="M 30 100 L 30 112 L 190 112 L 190 100" fill="none" stroke="#f43f5e" strokeWidth="2" />
                          {/* Circle cross rebars in other direction */}
                          <circle cx="45" cy="108" r="2.5" fill="#f43f5e" />
                          <circle cx="70" cy="108" r="2.5" fill="#f43f5e" />
                          <circle cx="95" cy="108" r="2.5" fill="#f43f5e" />
                          <circle cx="120" cy="108" r="2.5" fill="#f43f5e" />
                          <circle cx="145" cy="108" r="2.5" fill="#f43f5e" />
                          <circle cx="170" cy="108" r="2.5" fill="#f43f5e" />

                          {/* Column starter bars */}
                          <path d="M 102 10 L 102 112 L 115 112" fill="none" stroke="#e11d48" strokeWidth="1.5" />
                          <path d="M 118 10 L 118 112 L 105 112" fill="none" stroke="#e11d48" strokeWidth="1.5" />

                          <text x="110" y="142" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">ELEVATION SECTION DETAILS</text>
                        </svg>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
