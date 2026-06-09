/**
 * Foundation Database and Query API
 * Represents the normalized database model for structural foundation systems as requested.
 * All structural objects are modeled primarily through tables as the single source of truth.
 */
import type { Column } from "./structuralEngine";

// ============================================================================
// DATABASE TABLE TYPE DEFINITIONS (NORMALISED SCHEMA)
// ============================================================================

export interface FoundationRecord {
  FoundationID: string;
  FoundationType: 'Isolated' | 'Strip' | 'Combined' | 'Raft';
  Name: string;
  TopElevation: number;     // mm
  BottomElevation: number;  // mm
  MaterialID: string;       // e.g. "C25_420"
  SoilPropertySet: string;  // e.g. "SP-1"
  DesignGroup: string;      // e.g. "DG_F_INT"
  DrawingGroup: string;     // e.g. "DWG_F_1"
  Status: 'Pending' | 'Design' | 'Detailing' | 'Completed' | 'Failed';
  UserNotes: string;
}

export interface FoundationGeometryRecord {
  FoundationID: string;
  Shape: 'Rectangular' | 'Square' | 'Circular' | 'T-Shaped';
  Length: number;     // mm
  Width: number;      // mm
  Thickness: number;  // mm
  Rotation: number;   // degrees
  Area: number;       // m^2
  Volume: number;     // m^3
}

export interface FoundationAssignmentRecord {
  FoundationID: string;
  ObjectType: 'Column' | 'Wall' | 'Pedestal';
  ObjectID: string;
}

export interface FoundationLevelRecord {
  FoundationID: string;
  FoundationLevel: number; // mm
  ReferenceLevel: string;  // e.g. "Slab level" or "Ground"
  StepParentID: string;    // If stepped footing
  StepHeight: number;      // mm
}

export interface FoundationTypeRecord {
  TypeID: string;
  TypeName: string;
  Description: string;
  DefaultParameters: {
    Length: number;
    Width: number;
    Thickness: number;
    Shape: 'Rectangular' | 'Square' | 'Circular' | 'T-Shaped';
    BearingMultiplier?: number;
  };
}

export interface FoundationGroupRecord {
  GroupID: string;
  GroupName: string;
  DesignRules: {
    minThickness: number;      // mm
    maxBearingPressure: number; // kN/m^2
    reinforcementRatio: number; // e.g. 0.0018
    governingSpec: string;     // e.g. "ACI 318-19"
  };
  DrawingRules: {
    scale: string;            // e.g. "1:50"
    rebarNotation: string;    // e.g. "T16@150"
    detailingStyle: string;   // e.g. "Standard Bent Hooks"
  };
}

export interface SoilAssignmentRecord {
  FoundationID: string;
  SoilPropertyID: string;
  AllowableBearing: number; // kN/m^2
  Ks: number;              // kN/m^3 (Subgrade Reaction Modulus)
  Es: number;              // kN/m^2 (Soil Elastic Modulus)
  PoissonRatio: number;
  GroundwaterCondition: 'Dry' | 'Saturated' | 'Below Footing';
}

// Full Relational Foundation Database Object
export interface FoundationDatabase {
  Foundations: FoundationRecord[];
  Geometry: FoundationGeometryRecord[];
  Assignment: FoundationAssignmentRecord[];
  Levels: FoundationLevelRecord[];
  Types: FoundationTypeRecord[];
  Groups: FoundationGroupRecord[];
  Soil: SoilAssignmentRecord[];
}

// Validation Error Output
export interface ValidationError {
  id: string;
  type: 'ColumnWithoutFoundation' | 'WallWithoutFoundation' | 'FoundationWithoutObjects' | 'DuplicateAssignment' | 'InvalidReference' | 'MissingGeometry' | 'MissingSoil';
  severity: 'Warning' | 'Error';
  message: string;
  arMessage: string; // Arabic warning description
  targetID: string; // FoundationID or ObjectID
  fixable: boolean;
}

// ============================================================================
// DEFAULT REFERENCE TYPE ENTRIES & DEFINITIONS
// ============================================================================

export const DEFAULT_TYPES: FoundationTypeRecord[] = [
  {
    TypeID: "FT-ISO",
    TypeName: "Isolated Footing (قاعدة منفردة)",
    Description: "Supports a single structural Column or Pedestal",
    DefaultParameters: { Shape: "Square", Length: 1800, Width: 1800, Thickness: 500 }
  },
  {
    TypeID: "FT-STRIP",
    TypeName: "Strip Footing (قاعدة مستمرة/شريطية)",
    Description: "Supports a Wall or a line of collinear Columns",
    DefaultParameters: { Shape: "Rectangular", Length: 6000, Width: 1200, Thickness: 600 }
  },
  {
    TypeID: "FT-COMB",
    TypeName: "Combined Footing (قاعدة مشتركة)",
    Description: "Supports multiple Columns together (usually closer spacing or boundary limit)",
    DefaultParameters: { Shape: "Rectangular", Length: 4500, Width: 2200, Thickness: 700 }
  },
  {
    TypeID: "FT-RAFT",
    TypeName: "Raft Foundation (لبشة مسلحة)",
    Description: "Supports the entire base of the structure, modeling full soil slab matrix",
    DefaultParameters: { Shape: "Rectangular", Length: 30000, Width: 20000, Thickness: 1000 }
  }
];

export const DEFAULT_GROUPS: FoundationGroupRecord[] = [
  {
    GroupID: "FG-LIGHT",
    GroupName: "Light Loads Group (قواعد الأحمال الخفيفة)",
    DesignRules: { minThickness: 400, maxBearingPressure: 150, reinforcementRatio: 0.0018, governingSpec: "ACI 318-19" },
    DrawingRules: { scale: "1:25", rebarNotation: "T14@150", detailingStyle: "Straight Bars with standard hook L" }
  },
  {
    GroupID: "FG-HEAVY",
    GroupName: "Heavy Loads Group (قواعد الأحمال الثقيلة)",
    DesignRules: { minThickness: 600, maxBearingPressure: 180, reinforcementRatio: 0.002, governingSpec: "ACI 318-19" },
    DrawingRules: { scale: "1:50", rebarNotation: "T16@125", detailingStyle: "Bent hooks both sides" }
  },
  {
    GroupID: "FG-RAFT",
    GroupName: "Raft Group (مجموعة اللبشة)",
    DesignRules: { minThickness: 1000, maxBearingPressure: 150, reinforcementRatio: 0.0025, governingSpec: "ACI 318-19" },
    DrawingRules: { scale: "1:100", rebarNotation: "T20@150 Top & Bottom", detailingStyle: "Continuous Mesh" }
  }
];

// ============================================================================
// SYSTEM SEED GENERATOR
// ============================================================================

export function generateSeedDatabase(columns: Column[]): FoundationDatabase {
  const foundations: FoundationRecord[] = [];
  const geometry: FoundationGeometryRecord[] = [];
  const assignment: FoundationAssignmentRecord[] = [];
  const levels: FoundationLevelRecord[] = [];
  const soil: SoilAssignmentRecord[] = [];

  // Identify lowest column bases to assign foundations
  const minZ = columns.length > 0 ? Math.min(...columns.map(c => c.zBottom ?? 0)) : 0;
  const bottomCols = columns.filter(col => Math.abs((col.zBottom ?? 0) - minZ) < 500);

  // Let's create a mix of different foundation systems in the same project:
  // - Isolated Footings for several columns
  // - A Combined Footing for 2 columns close to each other
  // - A Strip Footing for 3 aligned columns
  // - A Raft Foundation for the rest (or we can partition them nicely)
  
  const colIds = bottomCols.map(c => c.id);

  if (colIds.length > 0) {
    // 1. Combined Footing (C1 + C2)
    const combCols = colIds.slice(0, Math.min(2, colIds.length));
    if (combCols.length >= 2) {
      const fId = "FD-COMB-01";
      foundations.push({
        FoundationID: fId,
        FoundationType: 'Combined',
        Name: "FC-1 (مشتركة)",
        TopElevation: -500,
        BottomElevation: -1200,
        MaterialID: "C25_420",
        SoilPropertySet: "SP-SAND-1",
        DesignGroup: "FG-HEAVY",
        DrawingGroup: "DWG_COMB",
        Status: 'Completed',
        UserNotes: "Combined Footing supporting boundary columns C1 & C2"
      });
      geometry.push({
        FoundationID: fId,
        Shape: 'Rectangular',
        Length: 4200,
        Width: 2000,
        Thickness: 700,
        Rotation: 0,
        Area: 8.4,
        Volume: 5.88
      });
      combCols.forEach(colId => {
        assignment.push({ FoundationID: fId, ObjectType: 'Column', ObjectID: colId });
      });
      levels.push({ FoundationID: fId, FoundationLevel: -1200, ReferenceLevel: "Ground Level", StepParentID: "", StepHeight: 0 });
      soil.push({ FoundationID: fId, SoilPropertyID: "SP-SAND-1", AllowableBearing: 160, Ks: 24000, Es: 35000, PoissonRatio: 0.3, GroundwaterCondition: 'Dry' });
    }

    // 2. Strip Footing supporting 3 columns (simulate wall line or continuous beam footing)
    const remainingAfterComb = colIds.slice(combCols.length);
    const stripCols = remainingAfterComb.slice(0, Math.min(3, remainingAfterComb.length));
    if (stripCols.length >= 2) {
      const fId = "FD-STRIP-01";
      foundations.push({
        FoundationID: fId,
        FoundationType: 'Strip',
        Name: "FS-1 (شريطية)",
        TopElevation: -600,
        BottomElevation: -1200,
        MaterialID: "C25_420",
        SoilPropertySet: "SP-SAND-1",
        DesignGroup: "FG-HEAVY",
        DrawingGroup: "DWG_STRIP",
        Status: 'Design',
        UserNotes: "Strip footing under aligned central column grid"
      });
      geometry.push({
        FoundationID: fId,
        Shape: 'Rectangular',
        Length: 8500,
        Width: 1200,
        Thickness: 600,
        Rotation: 0,
        Area: 10.2,
        Volume: 6.12
      });
      stripCols.forEach(colId => {
        assignment.push({ FoundationID: fId, ObjectType: 'Column', ObjectID: colId });
      });
      levels.push({ FoundationID: fId, FoundationLevel: -1200, ReferenceLevel: "Ground Level", StepParentID: "", StepHeight: 0 });
      soil.push({ FoundationID: fId, SoilPropertyID: "SP-SAND-1", AllowableBearing: 150, Ks: 20000, Es: 32000, PoissonRatio: 0.3, GroundwaterCondition: 'Below Footing' });
    }

    // 3. Isolated Footings for other columns
    const remainingAfterStrip = remainingAfterComb.slice(stripCols.length);
    const isolatedCols = remainingAfterStrip.slice(0, Math.min(4, remainingAfterStrip.length));
    isolatedCols.forEach((colId, i) => {
      const fId = `FD-ISO-${colId}`;
      foundations.push({
        FoundationID: fId,
        FoundationType: 'Isolated',
        Name: `F-${colId} (منفردة)`,
        TopElevation: -500,
        BottomElevation: -1000,
        MaterialID: "C25_420",
        SoilPropertySet: "SP-SAND-1",
        DesignGroup: "FG-LIGHT",
        DrawingGroup: "DWG_ISO",
        Status: 'Design',
        UserNotes: `Standard isolated footing for column ${colId}`
      });
      geometry.push({
        FoundationID: fId,
        Shape: 'Square',
        Length: 1800,
        Width: 1800,
        Thickness: 500,
        Rotation: 0,
        Area: 3.24,
        Volume: 1.62
      });
      assignment.push({ FoundationID: fId, ObjectType: 'Column', ObjectID: colId });
      levels.push({ FoundationID: fId, FoundationLevel: -1000, ReferenceLevel: "Ground Level", StepParentID: "", StepHeight: 0 });
      soil.push({ FoundationID: fId, SoilPropertyID: "SP-SAND-1", AllowableBearing: 150, Ks: 18000, Es: 30000, PoissonRatio: 0.28, GroundwaterCondition: 'Dry' });
    });

    // 4. A single Raft Foundation for the remaining columns, or a future expansion mockup of a Raft
    const remainingRaftCols = remainingAfterStrip.slice(isolatedCols.length);
    if (remainingRaftCols.length > 0) {
      const fId = "FD-RAFT-01";
      foundations.push({
        FoundationID: fId,
        FoundationType: 'Raft',
        Name: "FR-1 (لبشة عامة)",
        TopElevation: -1000,
        BottomElevation: -2000,
        MaterialID: "C25_420",
        SoilPropertySet: "SP-SAND-HEAVY",
        DesignGroup: "FG-RAFT",
        DrawingGroup: "DWG_RAFT",
        Status: 'Pending',
        UserNotes: "Mat / Raft foundation supporting heavy core shears"
      });
      geometry.push({
        FoundationID: fId,
        Shape: 'Rectangular',
        Length: 15000,
        Width: 12000,
        Thickness: 1000,
        Rotation: 0,
        Area: 180,
        Volume: 180
      });
      remainingRaftCols.forEach(colId => {
        assignment.push({ FoundationID: fId, ObjectType: 'Column', ObjectID: colId });
      });
      levels.push({ FoundationID: fId, FoundationLevel: -2000, ReferenceLevel: "Foundation level", StepParentID: "", StepHeight: 0 });
      soil.push({ FoundationID: fId, SoilPropertyID: "SP-SAND-HEAVY", AllowableBearing: 150, Ks: 15000, Es: 25000, PoissonRatio: 0.35, GroundwaterCondition: 'Saturated' });
    }
  }

  return {
    Foundations: foundations,
    Geometry: geometry,
    Assignment: assignment,
    Levels: levels,
    Types: DEFAULT_TYPES,
    Groups: DEFAULT_GROUPS,
    Soil: soil
  };
}

// ============================================================================
// CENTRAL DATABASE QUERY API (FOR ALL DEPENDENT MODULES)
// ============================================================================

export class FoundationQueryAPI {
  private db: FoundationDatabase;

  constructor(db: FoundationDatabase) {
    this.db = db;
  }

  /**
   * Reads from the master Foundations table
   */
  public GetFoundationByID(id: string): FoundationRecord | undefined {
    return this.db.Foundations.find(f => f.FoundationID === id);
  }

  /**
   * Reads foundations matching type
   */
  public GetFoundationsByType(type: 'Isolated' | 'Strip' | 'Combined' | 'Raft'): FoundationRecord[] {
    return this.db.Foundations.filter(f => f.FoundationType === type);
  }

  /**
   * Reads the Foundation Assignment table to find supported structural objects
   */
  public GetSupportedObjects(foundationId: string): FoundationAssignmentRecord[] {
    return this.db.Assignment.filter(a => a.FoundationID === foundationId);
  }

  /**
   * Resolves structural elements and reads / computes composite loads on the foundation
   */
  public GetFoundationLoads(
    foundationId: string, 
    columns: Column[], 
    colLoads3D?: Map<string, { P_service?: number; Pu?: number; MxBot?: number; MyBot?: number; Vu?: number }>
  ) {
    const assignments = this.GetSupportedObjects(foundationId);
    let totalP_service = 0;
    let totalPu = 0;
    let mx_sum = 0;
    let my_sum = 0;
    const supportedMembers: string[] = [];

    assignments.forEach(assign => {
      if (assign.ObjectType === 'Column') {
        const colId = assign.ObjectID;
        supportedMembers.push(colId);

        // Fetch loads if provided
        if (colLoads3D && colLoads3D.has(colId)) {
          const load = colLoads3D.get(colId)!;
          totalP_service += load.P_service ?? 200;
          totalPu += load.Pu ?? 300;
          mx_sum += load.MxBot ?? 0;
          my_sum += load.MyBot ?? 0;
        } else {
          // Default mock backup loads
          totalP_service += 250;
          totalPu += 375;
        }
      } else {
        // Mock wall or pedestal load
        totalP_service += 350;
        totalPu += 525;
        supportedMembers.push(`${assign.ObjectType}_${assign.ObjectID}`);
      }
    });

    return {
      FoundationID: foundationId,
      TotalServiceLoad: parseFloat(totalP_service.toFixed(1)),
      TotalUltimateLoad: parseFloat(totalPu.toFixed(1)),
      Mx: parseFloat(mx_sum.toFixed(1)),
      My: parseFloat(my_sum.toFixed(1)),
      SupportedMembers: supportedMembers
    };
  }

  /**
   * Reads the Foundation Geometry Table directly
   */
  public GetFoundationGeometry(foundationId: string): FoundationGeometryRecord | undefined {
    return this.db.Geometry.find(g => g.FoundationID === foundationId);
  }

  /**
   * Reads Soil Assignment parameters
   */
  public GetSoilProperties(foundationId: string): SoilAssignmentRecord | undefined {
    return this.db.Soil.find(s => s.FoundationID === foundationId);
  }

  /**
   * Reads Level parameters
   */
  public GetLevels(foundationId: string): FoundationLevelRecord | undefined {
    return this.db.Levels.find(l => l.FoundationID === foundationId);
  }

  // ==========================================================================
  // STABLE VALIDATION ENGINE
  // ==========================================================================
  public ValidateDatabase(columns: Column[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Find all bottom level columns (Z = min Z)
    const minZ = columns.length > 0 ? Math.min(...columns.map(c => c.zBottom ?? 0)) : 0;
    const bottomCols = columns.filter(col => Math.abs((col.zBottom ?? 0) - minZ) < 500);

    // 1. Detect: Columns without foundation assignments
    bottomCols.forEach(col => {
      const isAssigned = this.db.Assignment.some(
        a => a.ObjectType === 'Column' && a.ObjectID === col.id
      );
      if (!isAssigned) {
        errors.push({
          id: `err-col-unassigned-${col.id}`,
          type: 'ColumnWithoutFoundation',
          severity: 'Warning',
          message: `Column "${col.id}" is a column at the lowest level but has no foundation assigned.`,
          arMessage: `العمود "${col.id}" في المستوى السفلي ولكنه غير مربوط بأي قاعدة.`,
          targetID: col.id,
          fixable: true
        });
      }
    });

    // 2. Detect: Foundations without supported objects
    this.db.Foundations.forEach(f => {
      const supports = this.db.Assignment.filter(a => a.FoundationID === f.FoundationID);
      if (supports.length === 0) {
        errors.push({
          id: `err-fd-empty-${f.FoundationID}`,
          type: 'FoundationWithoutObjects',
          severity: 'Warning',
          message: `Foundation "${f.Name}" (ID: ${f.FoundationID}) does not support any columns or walls.`,
          arMessage: `القاعدة "${f.Name}" لا تدعم أي أعمدة أو جدران مخصصة لها.`,
          targetID: f.FoundationID,
          fixable: true
        });
      }
    });

    // 3. Detect: Duplicate assignments (same object assigned to multiple foundations)
    const assignmentCounts = new Map<string, string[]>(); // key: ObjectType:ObjectID, value: foundationIDs
    this.db.Assignment.forEach(as => {
      const key = `${as.ObjectType}:${as.ObjectID}`;
      if (!assignmentCounts.has(key)) {
        assignmentCounts.set(key, []);
      }
      assignmentCounts.get(key)!.push(as.FoundationID);
    });

    assignmentCounts.forEach((fIds, key) => {
      if (fIds.length > 1) {
        const [objType, objId] = key.split(':');
        errors.push({
          id: `err-duplicate-${key}`,
          type: 'DuplicateAssignment',
          severity: 'Error',
          message: `${objType} "${objId}" is assigned to multiple foundations simultaneously: ${fIds.join(", ")}.`,
          arMessage: `العنصر ${objId} مربوط بأكثر من قاعدة في نفس الوقت: ${fIds.join(", ")}.`,
          targetID: objId,
          fixable: true
        });
      }
    });

    // 4. Detect: Invalid references (assignments referencing columns that do not exist)
    this.db.Assignment.forEach((as, i) => {
      if (as.ObjectType === 'Column') {
        const exists = columns.some(c => c.id === as.ObjectID);
        if (!exists) {
          errors.push({
            id: `err-invalid-ref-${i}`,
            type: 'InvalidReference',
            severity: 'Error',
            message: `Foundation assignment references a column with ID "${as.ObjectID}" which does not exist in the project.`,
            arMessage: `ربط القاعدة يشير إلى عمود بالمعرف "${as.ObjectID}" غير موجود في المشروع.`,
            targetID: as.FoundationID,
            fixable: true
          });
        }
      }
    });

    // 5. Detect: Missing geometry records in the geometries table
    this.db.Foundations.forEach(f => {
      const geo = this.db.Geometry.some(g => g.FoundationID === f.FoundationID);
      if (!geo) {
        errors.push({
          id: `err-missing-geometry-${f.FoundationID}`,
          type: 'MissingGeometry',
          severity: 'Error',
          message: `Foundation "${f.Name}" is missing a geometry definition record in the Geometry table.`,
          arMessage: `القاعدة "${f.Name}" تفتقد لسجل أبعاد هندسية في جدول الهندسة (Geometry).`,
          targetID: f.FoundationID,
          fixable: true
        });
      }
    });

    // 6. Detect: Missing soil properties
    this.db.Foundations.forEach(f => {
      const soilProp = this.db.Soil.some(s => s.FoundationID === f.FoundationID);
      if (!soilProp) {
        errors.push({
          id: `err-missing-soil-${f.FoundationID}`,
          type: 'MissingSoil',
          severity: 'Warning',
          message: `Foundation "${f.Name}" is missing a soil characteristics record in the Soil Assignment table.`,
          arMessage: `القاعدة "${f.Name}" تفتقد لسجل خصائص التربة في جدول ربط التربة (Soil Assignment).`,
          targetID: f.FoundationID,
          fixable: true
        });
      }
    });

    return errors;
  }
}

// Force UI Sync Comment
