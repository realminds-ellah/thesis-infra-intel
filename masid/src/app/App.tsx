// MASID v2.1 — Production-Grade · UX Best Practices Pass
// DPWH | Philippine Space Agency | Region III

import { useState, useRef, useEffect, useMemo } from "react";
import { Toaster, toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from "recharts";
import {
  Map as MapIcon, List, Search, Bell, User, ChevronRight, ChevronLeft,
  ChevronUp, ChevronDown, AlertTriangle, CheckCircle, X, FileText,
  Layers, Filter, Upload, Camera, Flag, Download, Edit2, Menu,
  Calendar, Building2, Banknote, ArrowRight, RefreshCw, ExternalLink,
  Satellite, MessageSquare, ZoomIn, ZoomOut, Check, MapPin, Shield,
  Percent, BarChart2, Plus, LogOut, Settings, Users, Globe, Eye,
  EyeOff, Lock, Activity, Wifi, WifiOff, Star, Clock, TrendingUp,
  TrendingDown, CheckSquare, AlertCircle, Command, Inbox, Sun, Moon, MessageSquareWarning,
} from "lucide-react";

import {
  SCOPE_BY_ID,
  PROJECTS, CONTRACTORS, META, MUNI_BREAKDOWN, STATUS_PIE, BUDGET_BY_YEAR,
  FLAG_BREAKDOWN, FLAGGED_VALUE, MAP_BOUNDS, FLAG_LABELS, SEVERITY_CFG,
  BOUNDARIES, OFF_MAP, SATELLITE, SAT_BY_ID, SAT_TALLY, VERDICT_CFG, VALIDATION,
  PROCUREMENT, PROC_BY_ID, PROC_FLAG_LABELS, DOC_LABELS, FUSED_BY_ID, QUADRANT_CFG, TRIAGE, PRIORITY, YEAR_STATS,
} from "./data";
import type { Project, Contractor, ProjectStatus, AuditFlag } from "./data";
import { FilterPanel, type MapLayers } from "./FilterPanel";
import { ROLE_VIEWS } from "./roleFilters";
import { ProjectMap } from "./ProjectMap";
import { metresBetween } from "./geo";
import { LeafletMap } from "./LeafletMap";
import { SatelliteScreen } from "./SatelliteScreen";
import { NationwideScreen } from "./NationwideScreen";
import { RightOfReply } from "./RightOfReply";
import { StreetLevel } from "./StreetLevel";
import { WhatThePaperSays } from "./WhatThePaperSays";
import { InspectionBrief } from "./InspectionBrief";
import { ReportsFeed } from "./ReportsFeed";
import { HAZARD_BY_ID, plainSummary } from "./data";
import { ENCODINGS, ENCODING_BY_KEY, colorOf, shapeOf, markPath, legendFor, suggestEncoding, BASEMAP, type Encoding, type MarkShape } from "./mapColor";
import { type Filters, emptyFilters, applyFilters, fromQuery, activeCount, toQuery as toQueryString } from "./filters";
import { type Theme, loadTheme, saveTheme, applyTheme, watchSystem, resolveTheme, tint, accent } from "./theme";
import { type Lang, loadLang, saveLang, makeT, EN } from "./i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "dashboard" | "map" | "project-detail" | "satellite" | "documents" | "citizen-report" | "contractors" | "admin" | "transparency" | "nationwide";
import type { Role } from "./roles";
type SortDir = "asc" | "desc" | null;

interface Notification { id: number; type: string; title: string; body: string; time: string; read: boolean; }
interface AuditEntry   { user: string; action: string; target: string; time: string; ip: string; }
interface SystemUser   { name: string; role: Role; email: string; lastLogin: string; status: "active"|"inactive"|"suspended"; }

// ─── Data ─────────────────────────────────────────────────────────────────────



const NOTIFICATIONS: Notification[] = [
  { id:1, type:"flag",      title:"Project Auto-Flagged",       body:"BCF-2024-019 flagged — no structure detected in Nov satellite imagery.", time:"4 min ago",  read:false },
  { id:2, type:"deadline",  title:"Deadline in 7 Days",          body:"BCF-2023-062 (Balagtas Embankment) ends Sep 14. Currently at 79%.",       time:"1 hr ago",   read:false },
  { id:3, type:"report",    title:"New Citizen Report",           body:"Anonymous submitted an observation for Bocaue Floodway Expansion.",        time:"2 hrs ago",  read:false },
  { id:4, type:"satellite", title:"New Imagery Available",        body:"Sentinel-2 capture (Nov 15) ready for Norzagaray — 3.2% cloud cover.",    time:"5 hrs ago",  read:true  },
  { id:5, type:"coa",       title:"COA Flag — Budget Mismatch",  body:"BCF-2024-027: ₱2.5M discrepancy in BAC resolution vs contract amount.",    time:"Yesterday",  read:true  },
  { id:6, type:"system",    title:"PAGASA Feed Updated",          body:"Typhoon Carina forecast updated for Region III. 3 projects in high-risk.", time:"Yesterday",  read:true  },
  { id:7, type:"philgeps",  title:"PhilGEPS Sync Complete",       body:"12 new procurement postings matched to active MASID projects.",            time:"2 days ago", read:true  },
];

const SYSTEM_USERS: SystemUser[] = [
  { name:"Ana Reyes",      role:"dpwh-admin",       email:"a.reyes@dpwh.gov.ph",  lastLogin:"Just now",   status:"active"   },
  { name:"Ben Santos",     role:"field-inspector",  email:"b.santos@dpwh.gov.ph", lastLogin:"2 hrs ago",  status:"active"   },
  { name:"Carla Dizon",    role:"psa-analyst",      email:"c.dizon@psa.gov.ph",   lastLogin:"Yesterday",  status:"active"   },
  { name:"David Lim",      role:"lgu-coordinator",  email:"d.lim@bulacan.gov.ph", lastLogin:"3 days ago", status:"inactive" },
  { name:"Elena Cruz",     role:"dpwh-engineer",    email:"e.cruz@dpwh.gov.ph",   lastLogin:"1 hr ago",   status:"active"   },
  { name:"Francis Ocampo", role:"dpwh-engineer",    email:"f.ocampo@dpwh.gov.ph", lastLogin:"4 days ago", status:"suspended"},
];

const AUDIT_LOG: AuditEntry[] = [
  { user:"A. Reyes",  action:"Flagged project",            target:"BCF-2024-019",             time:"2024-11-14 09:23", ip:"192.168.1.102" },
  { user:"B. Santos", action:"Uploaded document",          target:"ProgReport_BCF-2024-033",  time:"2024-11-14 08:45", ip:"192.168.1.88"  },
  { user:"C. Dizon",  action:"Added satellite annotation", target:"BCF-2024-001 — confirmed", time:"2024-11-13 16:02", ip:"203.177.12.34" },
  { user:"A. Reyes",  action:"Approved document",          target:"Contract_BCF-2022-088",    time:"2024-11-13 14:30", ip:"192.168.1.102" },
  { user:"E. Cruz",   action:"Updated completion %",       target:"BCF-2024-033 → 48%",       time:"2024-11-13 11:15", ip:"192.168.1.75"  },
  { user:"B. Santos", action:"Submitted inspection",       target:"BCF-2024-001 Site Visit",  time:"2024-11-12 15:50", ip:"192.168.1.88"  },
  { user:"A. Reyes",  action:"Created project",            target:"BCF-2025-011",             time:"2024-11-11 10:00", ip:"192.168.1.102" },
];


const INTEGRATIONS = [
  { name:"PAGASA Rainfall API",       status:"live",     lastSync:"2 min ago",  icon:"🌧️" },
  { name:"PSA / Diwata-2 Feed",       status:"live",     lastSync:"4 hrs ago",  icon:"🛰️" },
  { name:"ESA Copernicus / Sentinel", status:"live",     lastSync:"12 hrs ago", icon:"🌍" },
  { name:"NAMRIA Basemap Tiles",      status:"live",     lastSync:"Real-time",  icon:"🗺️" },
  { name:"PhilGEPS Procurement Data", status:"degraded", lastSync:"2 days ago", icon:"📋" },
  { name:"COA Audit Database",        status:"offline",  lastSync:"Never",      icon:"📁" },
  { name:"PhilSys ID Verification",   status:"live",     lastSync:"Real-time",  icon:"🪪" },
  { name:"NDRRMC Alert Feed",         status:"live",     lastSync:"8 min ago",  icon:"🚨" },
];

// Chart series are derived from the real records in ../data — see MUNI_BREAKDOWN,
// STATUS_PIE, BUDGET_BY_YEAR and FLAG_BREAKDOWN there.
// ─── Config Maps ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ProjectStatus,{label:string;dot:string;bg:string;text:string}> = {
  completed: { label:"Completed",          dot:"#16a34a", bg:"#dcfce7", text:"#15803d" },
  ongoing:   { label:"Ongoing",            dot:"#2563eb", bg:"#dbeafe", text:"#1d4ed8" },
  proposed:  { label:"Proposed",           dot:"#94a3b8", bg:"#f1f5f9", text:"#64748b" },
  terminated:{ label:"Terminated",         dot:"#dc2626", bg:"#fee2e2", text:"#b91c1c" },
};
/** How a commenter is shown in a public thread — the role, not a username. */
const ROLE_LABELS_PUBLIC: Record<Role,string> = {
  "dpwh-admin":"DPWH Admin", "dpwh-engineer":"DPWH Engineer", "field-inspector":"Field Inspector",
  "psa-analyst":"PSA Analyst", "lgu-coordinator":"LGU Coordinator", "public":"Public",
};

const ROLE_CFG: Record<Role,{label:string;bg:string}> = {
  "dpwh-admin":     { label:"DPWH Admin",       bg:"#1e3a7b" },
  "dpwh-engineer":  { label:"DPWH Engineer",    bg:"#2563eb" },
  "field-inspector":{ label:"Field Inspector",  bg:"#0f766e" },
  "psa-analyst":    { label:"PSA Analyst",      bg:"#7c3aed" },
  "lgu-coordinator":{ label:"LGU Coordinator",  bg:"#b45309" },
  "public":         { label:"Public",           bg:"#64748b" },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const peso     = (n:number) => n >= 1_000_000_000 ? `₱${(n/1_000_000_000).toFixed(1)}B` : n >= 1_000_000 ? `₱${(n/1_000_000).toFixed(1)}M` : `₱${(n/1000).toFixed(0)}K`;
const pesoFull = (n:number) => `₱${n.toLocaleString("en-PH")}`;
const confColor= (c:number) => c >= 90 ? "#16a34a" : c >= 70 ? "#f59e0b" : "#dc2626";

// Extent comes from the published coordinates themselves, so the canvas always
// frames the real data rather than a hand-picked box.
const MB = { ...MAP_BOUNDS, W:720, H:580 };
const toXY = (lng:number, lat:number) => ({
  x:((lng-MB.minLng)/(MB.maxLng-MB.minLng))*MB.W,
  y:MB.H-((lat-MB.minLat)/(MB.maxLat-MB.minLat))*MB.H,
});

function sortRows<T>(arr:T[], key:keyof T|null, dir:SortDir):T[] {
  if(!key||!dir) return arr;
  return [...arr].sort((a,b)=>{
    const av=a[key], bv=b[key];
    if(typeof av==="number"&&typeof bv==="number") return dir==="asc"?av-bv:bv-av;
    return dir==="asc"?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
  });
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────

function useSort<T>(initial:keyof T|null=null) {
  const [sortKey, setSortKey] = useState<keyof T|null>(initial);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const toggle = (key:keyof T) => {
    if(sortKey===key) setSortDir(d=>d==="asc"?"desc":d==="desc"?null:"asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const apply = useMemo(()=>(arr:T[])=>sortRows(arr, sortKey, sortDir), [sortKey, sortDir]);
  return { sortKey, sortDir, toggle, apply };
}

/**
 * A contractor name short enough to sit on one axis tick.
 *
 * The register carries registered names in full — "TOPNOTCH CATALYST BUILDERS
 * INC. (34061) / ONE FRAME CONSTRUCTION INC." — and blunt truncation turned that
 * into "TOPNOTCH CATALYST BUIL", which is character-for-character what the
 * second-largest firm truncates to. Two different entities, one label. So a
 * joint venture keeps a piece of BOTH names, and only a single-firm name is cut,
 * with an ellipsis to say it was.
 */
function shortFirm(name:string):string {
  const clean=(s:string)=>s
    .replace(/\s*\((?:FORMERLY|FORMERLY:)[^)]*\)?.*$/i,"")  // "(FORMERLY X)"
    .replace(/\s*\(\d+\)/g,"")                              // PhilGEPS id
    .replace(/[,.]\s*(INC|CORP|CORPORATION)\.?$/i,"")
    .replace(/\s+/g," ").trim();
  const parts=name.split("/").map(s=>s.trim()).filter(Boolean);
  if(parts.length>1) {
    const head=(s:string)=>clean(s).split(" ").slice(0,2).join(" ");
    return `${head(parts[0])} / ${head(parts[1])}`;
  }
  const s=clean(name);
  return s.length>24 ? `${s.slice(0,23).replace(/[ ,]+$/,"")}…` : s;
}

function usePagination(total:number, pageSize=10) {
  const [page,setPage]=useState(1);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  return {
    page, pageSize, totalPages,
    setPage: (p:number) => setPage(Math.min(Math.max(1,p), Math.max(1,Math.ceil(total/pageSize)))),
    // Trailing comma disambiguates the type parameter from a JSX tag in .tsx.
    paginate:<T,>(arr:T[])=>arr.slice((page-1)*pageSize,page*pageSize),
    reset:()=>setPage(1),
  };
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

/**
 * Renders why a record was flagged.
 *
 * The wording is deliberate. Each entry states a discrepancy between published
 * records and stops there — it never claims a project was not built, and never
 * uses the word fraud. Whether anything is actually missing on the ground is a
 * question for imagery and inspection, neither of which has run yet.
 */
function AuditFlags({project,compact=false}:{project:Project;compact?:boolean}) {
  if(!project.auditFlags.length) return null;
  const inconsistent=project.auditFlags.filter(f=>f.kind!=="unverifiable");
  const unverifiable=project.auditFlags.filter(f=>f.kind==="unverifiable");
  const group=(title:string,flags:AuditFlag[],note:string)=>flags.length?(
    <div className={compact?"space-y-1.5":"space-y-2"}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <Flag size={11}/>{title}
        <span className="font-mono bg-gray-100 text-gray-500 px-1.5 rounded normal-case tracking-normal">{flags.length}</span>
      </div>
      {flags.map(f=>{
        const s=SEVERITY_CFG[f.severity];
        return (
          <div key={f.code} className="rounded border p-2.5 text-[11px]" style={{background:s.bg,borderColor:s.color+"33",color:s.color}}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={11}/>
              <span className="font-semibold">{FLAG_LABELS[f.code]??f.code}</span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-wider opacity-70">{s.label}</span>
            </div>
            <div className="text-gray-700 leading-relaxed">{f.detail}</div>
          </div>
        );
      })}
      <p className="text-[10px] text-gray-400 leading-relaxed">{note}</p>
    </div>
  ):null;
  return (
    <div className="space-y-4">
      {group("Consistency checks tripped",inconsistent,
        "The published record disagrees with itself or with official boundary data. It is a reason to look, not a finding.")}
      {group("Cannot be checked",unverifiable,
        "Nothing here disagrees with anything — the register simply does not publish enough to verify the site. Kept separate from the consistency checks, and not counted towards the suspicion score, because an absence is not a contradiction.")}
    </div>
  );
}

function StatusBadge({status,size="sm"}:{status:ProjectStatus;size?:"sm"|"md"}) {
  const c=STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded ${size==="md"?"px-2.5 py-1 text-xs":"px-2 py-0.5 text-[11px]"}`}
      style={{background:tint(c.text),color:accent(c.text)}}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:c.dot}}/>
      {c.label}
    </span>
  );
}

function SortTh<T>({col,label,sortKey,sortDir,onSort,className=""}:{
  col:keyof T; label:string; sortKey:keyof T|null; sortDir:SortDir; onSort:(k:keyof T)=>void; className?:string;
}) {
  const active=sortKey===col;
  return (
    <th className={`text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap select-none ${className}`}>
      <button onClick={()=>onSort(col)}
        className={`flex items-center gap-1 hover:text-gray-600 transition-colors ${active?"text-[#1e3a7b]":""}`}>
        {label}
        <span className="flex flex-col -space-y-1 ml-0.5">
          <ChevronUp   size={8} className={active&&sortDir==="asc"?"text-[#1e3a7b]":"text-gray-300"}/>
          <ChevronDown size={8} className={active&&sortDir==="desc"?"text-[#1e3a7b]":"text-gray-300"}/>
        </span>
      </button>
    </th>
  );
}

function Pagination({page,totalPages,setPage,total,pageSize}:{
  page:number; totalPages:number; setPage:(p:number)=>void; total:number; pageSize:number;
}) {
  if(totalPages<=1) return null;
  const pages=Array.from({length:Math.min(totalPages,5)},(_,i)=>{
    if(totalPages<=5) return i+1;
    if(page<=3) return i+1;
    if(page>=totalPages-2) return totalPages-4+i;
    return page-2+i;
  });
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
      <span className="text-[12px] text-gray-500">
        Showing {Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={()=>setPage(1)}      disabled={page===1} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">«</button>
        <button onClick={()=>setPage(page-1)} disabled={page===1} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
        {pages.map(p=>(
          <button key={p} onClick={()=>setPage(p)}
            className={`w-8 h-7 text-[12px] rounded border font-medium transition-colors ${p===page?"bg-[#1e3a7b] text-white border-[#1e3a7b]":"border-gray-200 text-gray-600 hover:bg-white"}`}>
            {p}
          </button>
        ))}
        <button onClick={()=>setPage(page+1)} disabled={page===totalPages} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">›</button>
        <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">»</button>
      </div>
    </div>
  );
}

function EmptyState({title,body,action,onAction}:{title:string;body:string;action?:string;onAction?:()=>void}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Inbox size={24} className="text-gray-300"/>
      </div>
      <div className="text-[14px] font-semibold text-gray-600 mb-1">{title}</div>
      <p className="text-[13px] text-gray-400 max-w-xs">{body}</p>
      {action&&onAction&&(
        <button onClick={onAction}
          className="mt-4 px-4 py-2 text-[13px] font-medium text-white rounded hover:opacity-90"
          style={{background:"var(--masid-navy)"}}>
          {action}
        </button>
      )}
    </div>
  );
}

function FilterChip({label,onRemove}:{label:string;onRemove:()=>void}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-[#1e3a7b]/20 text-[#1e3a7b]"
      style={{background:tint("#1e3a7b",10)}}>
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
        <X size={10}/>
      </button>
    </span>
  );
}

function ConfirmDialog({title,body,confirmLabel,danger,onConfirm,onCancel}:{
  title:string;body:string;confirmLabel:string;danger?:boolean;onConfirm:()=>void;onCancel:()=>void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{background:"rgba(13,31,60,0.45)"}}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${danger?"bg-red-100":"bg-amber-100"}`}>
            <AlertTriangle size={16} className={danger?"text-red-600":"text-amber-600"}/>
          </div>
          <div>
            <div className="text-[14px] font-bold text-gray-900">{title}</div>
            <p className="text-[13px] text-gray-500 mt-1">{body}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={()=>{onConfirm();onCancel();}}
            className={`px-4 py-2 text-[13px] font-semibold text-white rounded hover:opacity-90 ${danger?"bg-red-600":"bg-amber-600"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

type CmdAction = { group: string; icon: React.ReactNode; label: string; run: () => void };

function buildCmdActions(onNavigate:(s:Screen)=>void, onCreate:()=>void): CmdAction[] {
  return [
    { group:"Navigate",  icon:<MapIcon size={14}/>,    label:"Go to Map Dashboard",        run:()=>onNavigate("map") },
    { group:"Navigate",  icon:<BarChart2 size={14}/>,  label:"Go to Analytics Dashboard",  run:()=>onNavigate("dashboard") },
    { group:"Navigate",  icon:<Satellite size={14}/>,  label:"Go to Satellite Monitoring", run:()=>onNavigate("satellite") },
    { group:"Navigate",  icon:<FileText size={14}/>,   label:"Go to Documents",            run:()=>onNavigate("documents") },
    { group:"Navigate",  icon:<Camera size={14}/>,     label:"Go to Citizen Reports",      run:()=>onNavigate("citizen-report") },
    { group:"Navigate",  icon:<Building2 size={14}/>,  label:"Go to Contractor Registry",  run:()=>onNavigate("contractors") },
    { group:"Navigate",  icon:<Settings size={14}/>,   label:"Go to Admin Panel",          run:()=>onNavigate("admin") },
    { group:"Navigate",  icon:<Globe size={14}/>,      label:"Open Transparency Portal",   run:()=>onNavigate("transparency") },
    { group:"Actions",   icon:<Plus size={14}/>,       label:"Create New Project",         run:onCreate },
    { group:"Actions",   icon:<Upload size={14}/>,     label:"Upload Document",            run:()=>toast.success("Upload dialog opened") },
    { group:"Actions",   icon:<RefreshCw size={14}/>,  label:"Sync PhilGEPS Data",         run:()=>toast.info("Syncing PhilGEPS…") },
    { group:"Actions",   icon:<Download size={14}/>,   label:"Export All Projects (CSV)",  run:()=>toast.success("Exporting…") },
    ...PROJECTS.slice(0,5).map<CmdAction>(p=>({ group:"Projects", icon:<MapPin size={14}/>, label:p.name, run:()=>onNavigate("project-detail") })),
  ];
}

function CommandPalette({onClose,onNavigate,onCreate}:{onClose:()=>void;onNavigate:(s:Screen)=>void;onCreate:()=>void}) {
  const [q,setQ]=useState("");
  const [idx,setIdx]=useState(0);
  const inputRef=useRef<HTMLInputElement>(null);
  const actions=useMemo(()=>buildCmdActions(onNavigate,onCreate),[onNavigate,onCreate]);
  const filtered=useMemo(()=>q?actions.filter(a=>a.label.toLowerCase().includes(q.toLowerCase())):actions,[q,actions]);
  const groups=[...new Set(filtered.map(a=>a.group))];

  useEffect(()=>{ inputRef.current?.focus(); },[]);
  useEffect(()=>setIdx(0),[q]);

  const handleKey=(e:React.KeyboardEvent)=>{
    if(e.key==="ArrowDown"){e.preventDefault();setIdx(i=>Math.min(i+1,filtered.length-1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setIdx(i=>Math.max(i-1,0));}
    else if(e.key==="Enter"){e.preventDefault();filtered[idx]?.run();onClose();}
    else if(e.key==="Escape") onClose();
  };

  let flat=0;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" style={{background:"rgba(13,31,60,0.5)"}}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200" onKeyDown={handleKey}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0"/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search commands, projects, actions…"
            className="flex-1 text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"/>
          <kbd className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">ESC</kbd>
        </div>
        <div className="overflow-auto" style={{maxHeight:400,scrollbarWidth:"none"}}>
          {(near||nearErr)&&(
            <div className="absolute left-3 bottom-16 bg-white rounded border border-gray-200 shadow-xl overflow-hidden"
              style={{zIndex:900,width:320,maxHeight:"48vh"}}>
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <MapPin size={12} className="text-[#1e3a7b]"/>
                <span className="text-[12px] font-bold text-gray-700">Nearest to you</span>
                <button onClick={()=>{setNear(null);setNearErr(null);}}
                  className="ml-auto p-0.5 text-gray-400 hover:text-gray-600"><X size={13}/></button>
              </div>
              {nearErr?(
                <p className="px-3 py-3 text-[12px] text-gray-600 leading-relaxed">{nearErr}</p>
              ):(
                <div className="overflow-y-auto" style={{maxHeight:"40vh"}}>
                  {nearest.map(({p,m})=>(
                    <button key={p.id} onClick={()=>setSelectedId(p.id)}
                      className="w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{background:colorOf(p,enc)}}/>
                        <span className="font-mono text-[10px] text-gray-500">{p.id}</span>
                        <span className="ml-auto font-mono text-[11px] font-semibold text-gray-700">
                          {m<1000?`${m} m`:`${(m/1000).toFixed(1)} km`}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-700 leading-tight mt-0.5">
                        {p.municipality} · {p.description.slice(0,54)}…
                      </div>
                    </button>
                  ))}
                  {nearest.length===0&&(
                    <p className="px-3 py-3 text-[12px] text-gray-500">
                      No contract in the current filters has a coordinate to measure against.
                    </p>
                  )}
                </div>
              )}
              <p className="px-3 py-2 text-[10px] text-gray-400 leading-relaxed border-t border-gray-100">
                Straight-line distance from your device to the coordinate DPWH published. Your
                location is used in this browser only and is not sent anywhere.
              </p>
            </div>
          )}
          {filtered.length===0&&(
            <div className="py-10 text-center text-[13px] text-gray-400">No commands matching "{q}"</div>
          )}
          {groups.map(group=>{
            const items=filtered.filter(a=>a.group===group);
            return (
              <div key={group}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group}</div>
                {items.map(a=>{
                  const i=flat++;
                  return (
                    <button key={a.label} onClick={()=>{a.run();onClose();}}
                      onMouseEnter={()=>setIdx(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx===i?"bg-[#eef2f9]":""}`}>
                      <span className={`shrink-0 ${idx===i?"text-[#1e3a7b]":"text-gray-400"}`}>{a.icon}</span>
                      <span className={`text-[13px] ${idx===i?"font-medium text-[#1e3a7b]":"text-gray-700"}`}>{a.label}</span>
                      {idx===i&&<span className="ml-auto text-[10px] font-mono text-gray-400">↵</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-200 px-1 rounded">↑↓</kbd>navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-200 px-1 rounded">↵</kbd>select</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-200 px-1 rounded">esc</kbd>close</span>
          <span className="ml-auto flex items-center gap-1"><Command size={10}/><kbd className="font-mono bg-gray-200 px-1 rounded">K</kbd>to open</span>
        </div>
      </div>
    </div>
  );
}

// ─── Map components ───────────────────────────────────────────────────────────

// MapMarker and MapSVG were removed with the hand-drawn map they served. The
// register now uses Leaflet (src/app/LeafletMap.tsx): real tiles, working zoom,
// marker clustering and a satellite basemap — the parts BetterGov.ph's
// flood-control map got right, plus the imagery layer an audit tool needs.

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({onLogin}:{onLogin:(role:Role)=>void}) {
  const [email,setEmail]=useState("a.reyes@dpwh.gov.ph");
  const [password,setPassword]=useState("••••••••");
  const [showPw,setShowPw]=useState(false);
  const [role,setRole]=useState<Role>("dpwh-admin");
  const [loading,setLoading]=useState(false);
  const [errors,setErrors]=useState<{email?:string;password?:string}>({});

  const validate=()=>{
    const e:typeof errors={};
    if(!email.includes("@")) e.email="Enter a valid email address";
    if(password.length<4)    e.password="Password is required";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    if(!validate()) return;
    setLoading(true);
    setTimeout(()=>{setLoading(false);onLogin(role);},1000);
  };

  const roles:[Role,string][]=[["dpwh-admin","DPWH Administrator"],["dpwh-engineer","DPWH District Engineer"],["field-inspector","Field Inspector"],["psa-analyst","PSA Satellite Analyst"],["lgu-coordinator","LGU Coordinator"],["public","Public / Citizen"]];

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{fontFamily:"Inter, sans-serif"}}>
      <div className="w-[460px] shrink-0 flex flex-col justify-between p-10 relative overflow-hidden" style={{background:"linear-gradient(160deg,#0d2352 0%,#1e3a7b 55%,#1a4a8a 100%)"}}>
        <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)"}}/>
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded flex items-center justify-center" style={{background:"#f59e0b"}}><Shield size={18} style={{color:"#1e3a7b"}}/></div>
            {/* The acronym spelled out at least once, on the one screen every
                visitor passes through. It appeared nowhere in the app before. */}
            <div><div className="text-white font-bold text-lg tracking-widest">MASID</div><div className="text-white/50 tracking-wide" style={{fontSize:8.5}}>MONITORING AND SURVEILLANCE OF INFRASTRUCTURE DELIVERY</div></div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-tight mb-3">Infrastructure<br/>Monitoring for<br/>the Philippines</h2>
          <p className="text-white/50 text-sm leading-relaxed">An integrated platform for DPWH flood control tracking, satellite monitoring, procurement transparency, and citizen engagement.</p>
        </div>
        <div className="relative grid grid-cols-2 gap-3">
          {[
            {l:"Projects Loaded",  v:META.coverage.projects.toLocaleString()},
            {l:"Contract Value",   v:peso(META.coverage.totalBudget)},
            {l:"Flagged Records",  v:META.coverage.flagged.toLocaleString()},
            {l:"Contractors",      v:META.coverage.contractors.toLocaleString()},
          ].map(s=>(
            <div key={s.l} className="rounded p-3" style={{background:"rgba(255,255,255,0.07)"}}>
              <div className="text-white font-mono font-bold text-xl">{s.v}</div>
              <div className="text-white/40 text-[11px] mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="relative text-white/25 text-[11px]">Dept. of Public Works and Highways · Philippine Space Agency · Region III · DICT GovCloud PH</div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm px-4">
          <div className="mb-8"><h3 className="text-2xl font-bold text-gray-900 mb-1">Sign in to MASID</h3><p className="text-sm text-gray-500">Use your DPWH or agency credentials</p></div>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input id="email" value={email} onChange={e=>{setEmail(e.target.value);setErrors(p=>({...p,email:undefined}));}} type="email" autoComplete="email"
                className={`w-full px-3 py-2.5 text-sm border rounded bg-white text-gray-800 focus:outline-none focus:border-[#1e3a7b] transition-colors ${errors.email?"border-red-400":"border-gray-200"}`}/>
              {errors.email&&<p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input id="password" value={password} onChange={e=>{setPassword(e.target.value);setErrors(p=>({...p,password:undefined}));}} type={showPw?"text":"password"} autoComplete="current-password"
                  className={`w-full px-3 py-2.5 pr-10 text-sm border rounded bg-white text-gray-800 focus:outline-none focus:border-[#1e3a7b] transition-colors ${errors.password?"border-red-400":"border-gray-200"}`}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)} aria-label={showPw?"Hide password":"Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
              {errors.password&&<p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded p-3">
              <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Activity size={11}/>Demo — Select Role</div>
              <select value={role} onChange={e=>setRole(e.target.value as Role)} className="w-full text-sm border border-blue-200 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none">
                {roles.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} aria-busy={loading}
              className="w-full py-3 text-white text-sm font-semibold rounded flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#1e3a7b] focus:ring-offset-2"
              style={{background:"var(--masid-navy)"}}>
              {loading?<><RefreshCw size={15} className="animate-spin"/>Signing in…</>:<><Lock size={15}/>Sign In</>}
            </button>
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200"/><span className="text-[11px] text-gray-400">or</span><div className="flex-1 h-px bg-gray-200"/></div>
            <button type="button" onClick={()=>onLogin("public")}
              className="w-full py-2.5 text-sm font-medium border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">
              <Globe size={14}/>View Public Transparency Portal
            </button>
          </form>
          <p className="text-center text-[11px] text-gray-400 mt-8">Protected by DICT GovCloud PH · Data Privacy Act RA 10173</p>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel({onClose,notifications,onMarkAllRead}:{onClose:()=>void;notifications:Notification[];onMarkAllRead:()=>void}) {
  const iconMap: Record<string,React.ReactNode>={
    flag:<Flag size={13} className="text-amber-500"/>,deadline:<Clock size={13} className="text-red-500"/>,
    report:<Camera size={13} className="text-blue-500"/>,satellite:<Satellite size={13} className="text-purple-500"/>,
    coa:<AlertTriangle size={13} className="text-red-600"/>,system:<Activity size={13} className="text-gray-500"/>,
    philgeps:<FileText size={13} className="text-green-600"/>,
  };
  const unread=notifications.filter(n=>!n.read).length;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}/>
      <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 shadow-2xl rounded-lg z-50 flex flex-col overflow-hidden" style={{maxHeight:"calc(100vh - 80px)"}}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">Notifications</span>
            {unread>0&&<span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full text-white" style={{background:"#f59e0b"}}>{unread}</span>}
          </div>
          <div className="flex items-center gap-2">
            {unread>0&&<button onClick={onMarkAllRead} className="text-[11px] text-[#1e3a7b] hover:underline font-medium">Mark all read</button>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X size={15}/></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{scrollbarWidth:"none"}}>
          {notifications.length===0&&<EmptyState title="All caught up" body="No notifications at this time."/>}
          {notifications.map(n=>(
            <div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read?"bg-blue-50/40":""}`}>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">{iconMap[n.type]??<Bell size={13}/>}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-[12px] font-semibold text-gray-800">{n.title}</span>{!n.read&&<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:"#2563eb"}}/>}</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">{n.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100"><button className="w-full text-[12px] text-[#1e3a7b] font-medium hover:underline">View all notifications →</button></div>
      </div>
    </>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectModal({onClose,onSave}:{onClose:()=>void;onSave:()=>void}) {
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({name:"",type:"Flood Control Wall",municipality:"Malolos",description:"",lat:"14.843",lng:"120.811",fundingSource:"GAA 2025 — DPWH Infra Fund",budget:"",startDate:"",endDate:"",contractor:"",districtOffice:"Bulacan 1st DEO"});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const set=(k:string,v:string)=>{setForm(p=>({...p,[k]:v}));setErrors(p=>({...p,[k]:""}));};

  const validate=()=>{
    const e:Record<string,string>={};
    if(step===1&&!form.name.trim()) e.name="Project name is required";
    if(step===3&&!form.budget)      e.budget="Contract amount is required";
    if(step===3&&!form.startDate)   e.startDate="Start date is required";
    if(step===4&&!form.contractor)  e.contractor="Contractor selection is required";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const next=()=>{ if(validate()) setStep(s=>s+1); };
  const save=()=>{ if(!validate()) return; onSave(); toast.success("Project created — BCF-2025-019"); onClose(); };

  const steps=[{n:1,l:"Basic Info"},{n:2,l:"Location"},{n:3,l:"Financial"},{n:4,l:"Contractor"}];
  const projectTypes=["Flood Control Wall","River Dredging","Floodway Expansion","Retention Basin","Flood Gate System","Drainage Network","Tidal Barrier","Embankment Strengthening","Diversion Channel","LiDAR Survey"];
  const fundingSources=["GAA 2025 — DPWH Infra Fund","GAA 2025 — Flood Mitigation","NDRRMF 2025","ODA — JICA","ODA — ADB","ODA — World Bank","Pending — TBD"];
  const municipalities=["Angat","Balagtas","Baliuag","Bocaue","Bustos","Calumpit","Guiguinto","Hagonoy","Malolos","Marilao","Meycauayan","Norzagaray","Obando","Paombong","Pandi","Plaridel","Pulilan","San Jose del Monte","San Miguel","Sta. Maria"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(13,31,60,0.5)"}} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl flex flex-col overflow-hidden" style={{maxHeight:"90vh"}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div><h3 id="modal-title" className="text-[15px] font-bold text-gray-900">Create New Project</h3><p className="text-[12px] text-gray-400">Step {step} of 4 — {steps[step-1].l}</p></div>
          <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="flex border-b border-gray-100 shrink-0">
          {steps.map(s=>(
            <div key={s.n} className={`flex-1 py-2.5 text-center text-[11px] font-semibold transition-colors border-b-2 ${step===s.n?"border-[#1e3a7b] text-[#1e3a7b]":step>s.n?"border-green-400 text-green-600":"border-transparent text-gray-400"}`}>
              <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] mr-1.5 ${step===s.n?"bg-[#1e3a7b] text-white":step>s.n?"bg-green-500 text-white":"bg-gray-200 text-gray-500"}`}>{step>s.n?<Check size={10}/>:s.n}</span>{s.l}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4" style={{scrollbarWidth:"none"}}>
          {step===1&&<>
            <div><label htmlFor="proj-name" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Project Name <span className="text-red-400">*</span></label><input id="proj-name" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Angat River Flood Control Wall Phase IV" className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-[#1e3a7b] ${errors.name?"border-red-400":"border-gray-200"}`}/>{errors.name&&<p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}</div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Project Type</label><select value={form.type} onChange={e=>set("type",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{projectTypes.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">District Engineering Office</label><select value={form.districtOffice} onChange={e=>set("districtOffice",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{["Bulacan 1st DEO","Bulacan 2nd DEO","Bulacan 3rd DEO"].map(d=><option key={d}>{d}</option>)}</select></div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Brief scope of work…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b] resize-none"/></div>
          </>}
          {step===2&&<>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Municipality <span className="text-red-400">*</span></label><select value={form.municipality} onChange={e=>set("municipality",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{municipalities.map(m=><option key={m}>{m}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Latitude</label><input value={form.lat} onChange={e=>set("lat",e.target.value)} placeholder="14.8430" className="w-full px-3 py-2 text-sm border border-gray-200 rounded font-mono focus:outline-none focus:border-[#1e3a7b]"/></div>
              <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Longitude</label><input value={form.lng} onChange={e=>set("lng",e.target.value)} placeholder="120.8110" className="w-full px-3 py-2 text-sm border border-gray-200 rounded font-mono focus:outline-none focus:border-[#1e3a7b]"/></div>
            </div>
          </>}
          {step===3&&<>
            <div><label htmlFor="budget" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Contract Amount (₱) <span className="text-red-400">*</span></label><input id="budget" value={form.budget} onChange={e=>set("budget",e.target.value)} type="number" placeholder="45000000" className={`w-full px-3 py-2 text-sm border rounded font-mono focus:outline-none focus:border-[#1e3a7b] ${errors.budget?"border-red-400":"border-gray-200"}`}/>{errors.budget&&<p className="text-[11px] text-red-500 mt-1">{errors.budget}</p>}{form.budget&&<div className="text-[11px] text-gray-400 mt-1">{pesoFull(parseFloat(form.budget)||0)}</div>}</div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Funding Source</label><select value={form.fundingSource} onChange={e=>set("fundingSource",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{fundingSources.map(f=><option key={f}>{f}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="start" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date (NTP) <span className="text-red-400">*</span></label><input id="start" value={form.startDate} onChange={e=>set("startDate",e.target.value)} type="date" className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-[#1e3a7b] ${errors.startDate?"border-red-400":"border-gray-200"}`}/>{errors.startDate&&<p className="text-[11px] text-red-500 mt-1">{errors.startDate}</p>}</div>
              <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Target End Date</label><input value={form.endDate} onChange={e=>set("endDate",e.target.value)} type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]"/></div>
            </div>
          </>}
          {step===4&&<>
            <div><label htmlFor="contractor-sel" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Awarded Contractor <span className="text-red-400">*</span></label><select id="contractor-sel" value={form.contractor} onChange={e=>set("contractor",e.target.value)} className={`w-full px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:border-[#1e3a7b] ${errors.contractor?"border-red-400":"border-gray-200"}`}><option value="">— Select contractor —</option>{CONTRACTORS.map(c=><option key={c.id} value={c.name}>{c.name} — {c.totalProjects} contract{c.totalProjects===1?"":"s"}</option>)}</select>{errors.contractor&&<p className="text-[11px] text-red-500 mt-1">{errors.contractor}</p>}</div>
            {form.contractor&&(()=>{const c=CONTRACTORS.find(x=>x.name===form.contractor);if(!c)return null;const risky=c.flagRate>=0.25;return(<div className={`p-3 rounded border text-[12px] ${risky?"border-amber-200 bg-amber-50":"border-gray-200 bg-gray-50"}`}><div className="flex items-center gap-2 mb-2">{risky?<AlertTriangle size={13} className="text-amber-500"/>:<CheckCircle size={13} className="text-gray-400"/>}<span className={`font-semibold ${risky?"text-amber-700":"text-gray-600"}`}>{c.flaggedProjects} of {c.totalProjects} records flagged</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600"><span>Total awarded: <span className="font-mono">{peso(c.totalValue)}</span></span><span>Ongoing: {c.activeProjects}</span><span>Municipalities: {c.municipalities.length}</span><span>Years: <span className="font-mono">{c.years.length?`${c.years[0]}–${c.years[c.years.length-1]}`:"—"}</span></span></div></div>);})()}
          </>}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={()=>step>1?setStep(s=>s-1):onClose()} className="px-4 py-2 text-sm border border-gray-200 rounded text-gray-600 hover:bg-white">{step===1?"Cancel":"← Back"}</button>
          <button onClick={step<4?next:save} className="px-5 py-2 text-sm font-semibold text-white rounded hover:opacity-90" style={{background:"var(--masid-navy)"}}>{step<4?"Continue →":"Create Project"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

/**
 * Light or dark, and nothing else.
 *
 * This carried a third option — follow the operating system — and the argument
 * for it was good: a machine that turns dark at sunset should turn the dashboard
 * dark at sunset without being told. It was removed on request, and the request
 * is reasonable. Three states in a 78px control meant most people never worked
 * out what the monitor icon did, and a setting nobody understands is worse than
 * one that does not exist.
 *
 * The system preference still decides the FIRST view — see the inline script in
 * index.html — so a reader who has never touched this still lands in the theme
 * their device asked for. What is gone is only the ability to go back to
 * following it after choosing, which is a small loss for a much clearer control.
 */
function ThemeToggle({theme,setTheme}:{theme:Theme;setTheme:(t:Theme)=>void}) {
  const opts:[Theme,React.ReactNode,string][] = [
    ["light",  <Sun size={12}/>,  "Light"],
    ["dark",   <Moon size={12}/>, "Dark"],
  ];
  // "system" is still a valid stored value from before this changed; show it as
  // whichever it currently resolves to rather than leaving nothing selected.
  const shown = theme === "system" ? (resolveTheme("system")) : theme;
  return (
    <div role="radiogroup" aria-label="Colour theme"
      className="hidden sm:flex items-center gap-0.5 p-0.5 rounded border border-white/15 shrink-0">
      {opts.map(([t,icon,label])=>(
        <button key={t} role="radio" aria-checked={shown===t} title={label} aria-label={label}
          onClick={()=>setTheme(t)}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
            shown===t ? "bg-white/20 text-white" : "text-white/45 hover:text-white hover:bg-white/10"}`}>
          {icon}
        </button>
      ))}
    </div>
  );
}

function TopNav({screen,onNavigate,onToggleSidebar,canToggleSidebar,onToggleNotifications,unreadCount,role,onLogout,onCreateProject,canCreate,onOpenPalette,theme,setTheme,lang,setLang}:{
  screen:Screen;onNavigate:(s:Screen)=>void;onToggleSidebar:()=>void;canToggleSidebar:boolean;onToggleNotifications:()=>void;
  unreadCount:number;role:Role;onLogout:()=>void;onCreateProject:()=>void;canCreate:boolean;onOpenPalette:()=>void;
  theme:Theme;setTheme:(t:Theme)=>void;lang:Lang;setLang:(l:Lang)=>void;
}) {
  const rc=ROLE_CFG[role];
  const t=makeT(lang,EN);
  const links:[string,Screen,React.ReactNode,Role[]|null][]=[
    [t("nav.dashboard"),"dashboard",<BarChart2 size={13}/>,null],
    [t("nav.map"),"map",<MapIcon size={13}/>,null],
    [t("nav.satellite"),"satellite",<Satellite size={13}/>,null],
    [t("nav.documents"),"documents",<FileText size={13}/>,null],
    [t("nav.reports"),"citizen-report",<Camera size={13}/>,null],
    [t("nav.contractors"),"contractors",<Building2 size={13}/>,["dpwh-admin","dpwh-engineer"]],
    [t("nav.admin"),"admin",<Settings size={13}/>,["dpwh-admin"]],
    [t("nav.nationwide"),"nationwide",<Globe size={13}/>,null],
    [t("nav.public"),"transparency",<Shield size={13}/>,null],
  ];
  const visible=links.filter(([,,, roles])=>!roles||roles.includes(role));
  return (
    <header className="h-[52px] shrink-0 flex items-center gap-2 px-3 border-b border-white/10" style={{background:"var(--masid-navy)"}}>
      {/* Only offered where a sidebar exists to collapse. It used to sit on every
          screen and do nothing on most of them. */}
      {canToggleSidebar
        ? <button onClick={onToggleSidebar} aria-label="Toggle filters" title="Show or hide the filters"
            className="w-7 h-7 flex items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"><Menu size={16}/></button>
        : <div className="w-7 h-7"/>}
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <div className="w-7 h-7 rounded flex items-center justify-center" style={{background:"#f59e0b"}}><Shield size={14} style={{color:"#1e3a7b"}}/></div>
        {/* Short in the nav bar, where there is no room; the full name is on the
            title so it is one hover away rather than nowhere. */}
        <div className="leading-none" title="MASID — Monitoring And Surveillance of Infrastructure Delivery"><div className="text-white font-bold text-sm tracking-widest">MASID</div><div className="text-white/40 tracking-wider" style={{fontSize:8}}>FLOOD CONTROL PH</div></div>
      </div>
      <nav className="flex items-center gap-0.5 overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {visible.map(([label,s,icon])=>(
          <button key={s} onClick={()=>onNavigate(s)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 ${screen===s?"bg-white/15 text-white":"text-white/55 hover:text-white hover:bg-white/8"}`}>
            {icon}{label}
          </button>
        ))}
      </nav>
      <div className="flex-1"/>
      <button onClick={onOpenPalette} title="Command Palette (⌘K)"
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded text-[12px] text-white/50 hover:text-white border border-white/15 hover:border-white/30 transition-colors shrink-0">
        <Command size={12}/><span>Search</span><kbd className="font-mono text-[10px] ml-1 opacity-60">⌘K</kbd>
      </button>
      {canCreate&&(
        <button onClick={onCreateProject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold shrink-0 transition-opacity hover:opacity-90"
          style={{background:"#f59e0b",color:"#1e3a7b"}}>
          <Plus size={13}/>New Project
        </button>
      )}
      {/* Language before theme: which words the interface uses matters more to
          the person this was built for than whether it is light or dark. */}
      <div role="radiogroup" aria-label="Language"
        className="hidden sm:flex items-center gap-0.5 p-0.5 rounded border border-white/15 shrink-0">
        {([["en","EN","English"],["fil","FIL","Filipino"]] as const).map(([v,short,full])=>(
          <button key={v} role="radio" aria-checked={lang===v} title={full} aria-label={full}
            onClick={()=>setLang(v)}
            className={`px-1.5 h-6 flex items-center justify-center rounded text-[10px] font-bold tracking-wide transition-colors ${
              lang===v?"bg-white/20 text-white":"text-white/45 hover:text-white hover:bg-white/10"}`}>
            {short}
          </button>
        ))}
      </div>
      <ThemeToggle theme={theme} setTheme={setTheme}/>
      <button onClick={onToggleNotifications} aria-label={`Notifications${unreadCount>0?`, ${unreadCount} unread`:""}`}
        className="relative w-8 h-8 flex items-center justify-center text-white/55 hover:text-white transition-colors shrink-0">
        <Bell size={17}/>
        {unreadCount>0&&<span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-[#1e3a7b]" style={{background:"#f59e0b",color:"#1e3a7b"}}>{unreadCount}</span>}
      </button>
      <div className="flex items-center gap-2 pl-2 border-l border-white/15 shrink-0">
        <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center" aria-hidden="true"><User size={14} className="text-white/80"/></div>
        <div className="text-[11px] leading-tight hidden sm:block">
          <div className="text-white font-semibold">A. Reyes</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium text-white" style={{background:rc.bg}}>{rc.label}</span>
        </div>
        <button onClick={onLogout} title="Sign out" className="ml-1 text-white/40 hover:text-white transition-colors"><LogOut size={14}/></button>
      </div>
    </header>
  );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

// LeftSidebar was replaced by FilterPanel (src/app/FilterPanel.tsx): five status
// checkboxes and a single-handle budget slider, versus faceted multi-select with
// live counts, data-derived ranges and shareable URL state.

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

function DashboardScreen({onNavigate,onViewDetail}:{onNavigate:(s:Screen)=>void;onViewDetail:(id:string)=>void}) {
  const totalBudget=META.coverage.totalBudget;
  const flagged=PROJECTS.filter(p=>p.auditFlags.length);
  const highSeverity=PROJECTS.filter(p=>p.auditFlags.some(f=>f.severity==="high"));
  const atRisk=[...flagged].sort((a,b)=>b.auditScore-a.auditScore||b.budget-a.budget);
  const withCoords=META.coverage.withCoordinates;
  const avgCompletion=PROJECTS.reduce((s,p)=>s+p.completion,0)/PROJECTS.length;
  const pct=(n:number)=>`${Math.round(n/PROJECTS.length*100)}%`;
  // 309 flagged records used to render as 309 table rows, which is most of why
  // this page was 23 screens tall. Ten at a time, newest concern first.
  const pg=usePagination(atRisk.length,10);

  /**
   * Where the money went.
   *
   * The question every reader of a public works register actually arrives with,
   * and the one the rest of this dashboard does not answer. Bars are total award
   * value per firm; the headline is the concentration behind them.
   */
  const money=useMemo(()=>{
    const ranked=[...CONTRACTORS].sort((a,b)=>b.totalValue-a.totalValue);
    const total=ranked.reduce((s,c)=>s+c.totalValue,0);
    let cum=0,half=0;
    for(const c of ranked){cum+=c.totalValue;half++;if(cum/total>=0.5)break;}
    const revoked=ranked.filter(c=>c.registrationRevoked);
    return {
      total, half, firms:ranked.length,
      revokedCount:revoked.length,
      revokedValue:revoked.reduce((s,c)=>s+c.totalValue,0),
      top:ranked.slice(0,10).map(c=>({
        name:shortFirm(c.name),
        full:c.name, valueB:+(c.totalValue/1e9).toFixed(2),
        share:c.totalValue/total, contracts:c.totalProjects,
        revoked:!!c.registrationRevoked,
      })),
    };
  },[]);
  // Every figure below is counted from the loaded records. Where the public
  // record has no number — disbursement above all — none is shown.
  const kpis=[
    {l:"Flood Control Projects",  v:PROJECTS.length.toLocaleString(),  s:`${META.areaOfInterest}, ${META.coverage.yearMin}–${META.coverage.yearMax}`, trend:`${META.coverage.contractors} contractors`, up:true,  c:"#1e3a7b"},
    {l:"Contract Value",          v:peso(totalBudget),                 s:"Awarded amount; disbursement not published", trend:`${peso(FLAGGED_VALUE)} flagged`, up:false, c:"#16a34a"},
    {l:"Flagged for Review",      v:String(flagged.length),            s:`${pct(flagged.length)} of all records`, trend:`${highSeverity.length} high severity`, up:false, c:"#f59e0b"},
    {l:"Coordinates Published",   v:pct(withCoords),                   s:`${withCoords.toLocaleString()} of ${PROJECTS.length.toLocaleString()} locatable`, trend:`${PROJECTS.length-withCoords} without`, up:false, c:"#2563eb"},
    {l:"Reported Completion",     v:`${avgCompletion.toFixed(1)}%`,    s:"Mean DPWH-reported progress", trend:`${PROJECTS.filter(p=>p.dpwhStatus==="Completed").length} marked complete`, up:true, c:"#7c3aed"},
    {l:"Imagery Assessed",        v:SATELLITE.coverage.assessed.toLocaleString(), s:`Sentinel-2 10 m · ${SATELLITE.coverage.assessable.toLocaleString()} assessable`, trend:VALIDATION.discriminates?"validated against controls":"no discriminative power", up:false, c:VALIDATION.discriminates?"#0f766e":"#b91c1c"},
  ];
  // Series colours as custom properties: an SVG fill accepts var(), so the
  // charts follow the theme with no hook, no re-render and no second palette.
  const NAVY="var(--masid-navy)",GREEN="#16a34a",AMBER="#f59e0b",GRAY="#94a3b8";

  /** A named group, so the page reads as four questions rather than nine cards. */
  const Section=({label,note,children}:{label:string;note?:string;children:React.ReactNode})=>(
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 shrink-0">{label}</h2>
        {note&&<span className="text-[11px] text-gray-400 truncate">{note}</span>}
        <div className="flex-1 border-b border-gray-200"/>
      </div>
      {children}
    </section>
  );

  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{scrollbarWidth:"none"}}>
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-lg font-bold text-gray-900">Executive Dashboard</h1><p className="text-[13px] text-gray-500">{META.areaOfInterest} · DPWH Region III · {META.coverage.projects.toLocaleString()} flood control records, {META.coverage.yearMin}–{META.coverage.yearMax} · dataset built {META.generated.slice(0,10)}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>toast.success("Exporting PDF report…")} className="flex items-center gap-1.5 px-3 py-2 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><Download size={13}/>Export PDF</button>
            <button onClick={()=>onNavigate("map")} className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-white rounded hover:opacity-90" style={{background:"var(--masid-navy)"}}><MapIcon size={13}/>Open Map</button>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Section label="Overview" note="counted from the loaded records; no figure here is estimated">
        <div className="grid grid-cols-6 gap-3">
          {kpis.map(k=>(
            <div key={k.l} className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{k.l}</div>
              <div className="font-mono font-bold text-2xl mb-1" style={{color:k.c}}>{k.v}</div>
              <div className="text-[11px] text-gray-500 mb-2">{k.s}</div>
              <div className={`flex items-center gap-1 text-[11px] font-medium ${k.up?"text-green-600":"text-red-500"}`}>
                {k.up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{k.trend}
              </div>
            </div>
          ))}
        </div>
        </Section>

        <Section label="Where the contracts are" note={`${META.coverage.municipalitiesServed.length} municipalities served by this district office`}>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700 mb-4">Projects by Municipality</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={MUNI_BREAKDOWN} layout="vertical" margin={{top:0,right:16,bottom:0,left:78}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                <XAxis type="number" tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <YAxis dataKey="name" type="category" tick={{fontSize:9,fill:"#64748b"}} tickLine={false} axisLine={false} width={78} interval={0}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                {/* Three lifecycle stages, which is all DPWH reports. Flagged and
                    Terminated were also drawn here and were zero in every bar —
                    two legend entries standing for nothing. Flagged in particular
                    is a condition, not a stage; it has its own panel below. */}
                <Bar dataKey="completed"  name="Completed"  stackId="a" fill={GREEN}/>
                <Bar dataKey="ongoing"    name="Ongoing"    stackId="a" fill={NAVY}/>
                <Bar dataKey="proposed"   name="Proposed"   stackId="a" fill={GRAY} radius={[0,2,2,0]}/>
                <Legend iconType="square" iconSize={8} wrapperStyle={{fontSize:11}}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded border border-gray-200 p-4 flex flex-col">
            <div className="text-[12px] font-bold text-gray-700 mb-2">Status Distribution</div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart><Pie data={STATUS_PIE} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>{STATUS_PIE.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip contentStyle={{fontSize:11,borderRadius:6}}/></PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1 w-full">
                {STATUS_PIE.map(e=><div key={e.name} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full shrink-0" style={{background:e.color}}/><span className="text-[11px] text-gray-600">{e.name}</span><span className="font-mono font-bold text-[11px] ml-auto" style={{color:e.color}}>{e.value}</span></div>)}
              </div>
            </div>
          </div>
        </div>
        </Section>

        <Section label="Where the money went" note={`${peso(money.total)} awarded across ${money.firms} firms`}>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700">Contract value awarded, by year (₱M)</div>
            <div className="text-[11px] text-gray-400 mb-3">Spending rose roughly 58-fold between 2016 and 2024.</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={YEAR_STATS} margin={{top:0,right:8,bottom:0,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="year" tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}} formatter={(v:number)=>[`₱${v.toLocaleString()}M`,"awarded"]}/>
                <Bar dataKey="valueM" name="Awarded" fill="var(--masid-blue)" radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The question a reader arrives with, and the one nothing else on this
              page answered: which companies got the money. Bars are total award
              value per firm — one hue, because every bar is the same kind of
              thing and the length is the whole message. */}
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="flex items-baseline gap-2">
              <div className="text-[12px] font-bold text-gray-700">Who was paid — ten largest contractors</div>
              <button onClick={()=>onNavigate("contractors")}
                className="text-[11px] text-[#1e3a7b] hover:underline ml-auto shrink-0">All {money.firms} firms →</button>
            </div>
            <div className="text-[11px] text-gray-400 mb-3">
              <strong className="text-gray-600">{money.half} of {money.firms} firms hold half</strong> of the {peso(money.total)} awarded.
              {money.revokedCount>0&&<> {money.revokedCount} firms carry a registration DPWH marks revoked ({peso(money.revokedValue)}).</>}
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={money.top} layout="vertical" margin={{top:0,right:34,bottom:0,left:152}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                <XAxis type="number" tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}
                  tickFormatter={(v:number)=>`₱${v}B`}/>
                {/* One line per firm. Recharts' default tick wraps a long name onto
                    extra lines, and ten wrapped names overlap into an unreadable
                    block — the names have to stay on one row each. */}
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={152} interval={0}
                  tick={({x,y,payload}:{x:number;y:number;payload:{value:string}})=>(
                    <text x={x} y={y} dy={3} textAnchor="end" fontSize={9} fill="#64748b">{payload.value}</text>
                  )}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}}
                  formatter={(v:number,_n,p:{payload:{share:number;contracts:number}})=>
                    [`₱${v}B — ${(p.payload.share*100).toFixed(1)}% of all award value, ${p.payload.contracts} contracts`,"awarded"]}
                  labelFormatter={(_l,pl)=>pl?.[0]?.payload?.full??""}/>
                <Bar dataKey="valueB" name="Awarded" fill={NAVY} radius={[0,2,2,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Section>

        <Section label="What the record disputes" note="checks on published documents — not observations of the ground">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700">Share won at exactly 96.00% of the approved budget</div>
            <div className="text-[11px] text-gray-400 mb-3">
              Absent through 2018, then 51% in 2020 and never below 36% since. The national rate is 3.9%.
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={YEAR_STATS} margin={{top:0,right:8,bottom:0,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="year" tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}
                  domain={[0,0.65]} tickFormatter={(v:number)=>`${Math.round(v*100)}%`}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}}
                  formatter={(v:number,_n,p:{payload:{at96:number;withRatio:number}})=>[`${(v*100).toFixed(0)}%  (${p.payload.at96} of ${p.payload.withRatio})`,"at 96.00%"]}/>
                <Bar dataKey="at96Rate" name="At 96.00%" fill="#e8722c" radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700">Records by consistency check</div>
            <div className="text-[11px] text-gray-400 mb-3">
              <strong className="text-gray-600">{flagged.length} records</strong> trip at least one check. A record can trip more than one.
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={FLAG_BREAKDOWN} layout="vertical" margin={{top:0,right:24,bottom:0,left:120}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                <XAxis type="number" tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <YAxis dataKey="label" type="category" tick={{fontSize:9,fill:"#64748b"}} tickLine={false} axisLine={false} width={120}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}}/>
                <Bar dataKey="count" name="Records" fill={AMBER} radius={[0,2,2,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Section>

        <Section label="What to audit first" note="an ordering of the published record, not a prediction about the ground">
        {/* The 2x2 the fusion exists to produce. Two signals that are not
            proxies for each other — the contract record disagreeing with itself,
            and the bidding pattern — computed to correlate at r = -0.26 across
            all 1,293 contracts, so "both" is genuinely narrower than either list
            on its own. The figure is exported as SIGNAL_CORRELATION rather than
            written here by hand; two hand-written copies had already drifted to
            two different wrong values. */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
            <Layers size={14} className="text-[#1e3a7b]"/>
            <span className="text-[12px] font-bold text-gray-700">Audit-Priority Triage</span>
            <span className="text-[11px] text-gray-400">· contract record × bidding red flags · this office awards at exactly 96.00% of the approved budget on {(PROCUREMENT.office.at96Rate*100).toFixed(1)}% of contracts, rank {PROCUREMENT.office.deoRankAt96} of {PROCUREMENT.office.deosCompared} DEOs (national {(PROCUREMENT.nationalBaseline.at96Rate*100).toFixed(1)}%)</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            {(["both","records-only","procurement-only","neither"] as const).map(q=>{
              const c=QUADRANT_CFG[q];
              return (
                <div key={q} className="p-4" title={c.note}>
                  <div className="font-mono text-2xl font-bold" style={{color:c.color}}>{TRIAGE.counts[q].toLocaleString()}</div>
                  <div className="text-[11px] font-semibold text-gray-600 mt-0.5">{c.label}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{peso(TRIAGE.value[q])}</div>
                </div>
              );
            })}
          </div>
          {PRIORITY.length>0&&(
            <>
              <div className="px-5 py-2.5 border-t border-gray-100 bg-red-50/40 text-[11px] text-gray-600">
                <strong className="text-red-700">Investigate first —</strong> both signals, highest value first.
                An ordering, not a prediction: there is no public itemised list of confirmed
                ghost projects to validate a ranking against.
              </div>
              <div className="overflow-x-auto">
                {/* Scrolls rather than clips. The card around this table is
                    overflow-hidden, so on a 390px phone columns four onward were
                    not merely cramped, they were invisible and unreachable. */}
              <table className="w-full text-[12px] min-w-[760px]">
                <thead><tr className="border-b border-gray-100 bg-gray-50">{["Contract","Municipality","Contractor","Value","Signals","Action"].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                <tbody>
                  {PRIORITY.slice(0,8).map(f=>{
                    const p=PROJECTS.find(x=>x.id===f.id)!;
                    const pr=PROC_BY_ID.get(f.id);
                    const codes=[...p.auditFlags.map(x=>FLAG_LABELS[x.code]??x.code),
                                 ...(pr?.procurementFlags??[]).map(x=>PROC_FLAG_LABELS[x.code]??x.code)];
                    return (
                      <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-mono text-[11px] text-gray-500">{f.id}</div><div className="text-gray-800 text-[11px]">{p.name.slice(0,40)}…</div></td>
                        <td className="px-4 py-3 text-gray-600">{p.municipality}</td>
                        <td className="px-4 py-3 text-gray-600 text-[11px]">{p.contractor.replace(/\s*\(.*$/,"").slice(0,30)}</td>
                        <td className="px-4 py-3 font-mono">{peso(p.budget)}</td>
                        <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{codes.slice(0,3).map(c=><span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700">{c}</span>)}</div></td>
                        <td className="px-4 py-3"><button onClick={()=>onViewDetail(f.id)} className="text-[#1e3a7b] text-[11px] font-medium flex items-center gap-1 hover:underline">Review<ArrowRight size={10}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500"/>
            <span className="text-[12px] font-bold text-gray-700">At-Risk &amp; Flagged Projects</span>
            <span className="text-[11px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded ml-1">{atRisk.length}</span>
          </div>
          {atRisk.length===0?<EmptyState title="No at-risk projects" body="All active projects are progressing on schedule."/>:(
            <>
            <div className="overflow-x-auto">
              {/* Scrolls rather than clips. The card around this table is
                  overflow-hidden, so on a 390px phone columns four onward were
                  not merely cramped, they were invisible and unreachable. */}
            <table className="w-full text-[12px] min-w-[760px]">
              <thead><tr className="border-b border-gray-100 bg-gray-50">{["Project","Municipality","Contractor","Reported progress","Status","Imagery","Action"].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {pg.paginate(atRisk).map(p=>(
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><div className="font-medium text-gray-800">{p.name.slice(0,42)}{p.name.length>42?"…":""}</div><div className="text-[10px] font-mono text-gray-400">{p.id}</div></td>
                    <td className="px-4 py-3 text-gray-600">{p.municipality}</td>
                    <td className="px-4 py-3 text-gray-600">{p.contractor}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${p.completion}%`,background:STATUS_CFG[p.status].dot}}/></div><span className="font-mono text-[11px] text-gray-600">{p.completion}%</span></div></td>
                    <td className="px-4 py-3"><StatusBadge status={p.status}/></td>
                    <td className="px-4 py-3">{(()=>{
                      const sat=SAT_BY_ID.get(p.id);
                      if(!sat) return <span className="text-[11px] text-gray-300">not assessed</span>;
                      const v=VERDICT_CFG[sat.verdict];
                      return <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{background:tint(v.color),color:accent(v.color)}} title={v.note}>{v.short}</span>;
                    })()}</td>
                    <td className="px-4 py-3"><button onClick={()=>onViewDetail(p.id)} className="text-[#1e3a7b] text-[11px] font-medium flex items-center gap-1 hover:underline">Review<ArrowRight size={10}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination page={pg.page} totalPages={pg.totalPages} setPage={pg.setPage}
              total={atRisk.length} pageSize={pg.pageSize}/>
            </>
          )}
        </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Map Screen ───────────────────────────────────────────────────────────────

function MapScreen({projects,onViewDetail,filters,onClearFilters,role,layers,colorBy}:{projects:Project[];onViewDetail:(id:string)=>void;filters:Filters;onClearFilters:()=>void;role:Role;layers:MapLayers;colorBy:string|null}) {
  const [selectedId,setSelectedId]=useState("");
  const [briefFor,setBriefFor]=useState<Project|null>(null);
  const [viewMode,setViewMode]=useState<"map"|"list">("map");
  // Colour follows the filter unless the user overrides it: setting a delivery
  // filter and then having to pick "colour by delivery" separately is a step
  // that should not exist.
  // The filter wins if it implies an encoding; otherwise the role's default —
  // an inspector opens on delivery, an analyst on flood exposure.
  const roleDefault=(ROLE_VIEWS[role]??ROLE_VIEWS["dpwh-admin"]).defaultEncoding;
  // Site status unless the reader picks otherwise, or unless the filters they
  // set imply a different question. The dots and the filter checkboxes have to
  // agree out of the box; anything else is two legends contradicting each other.
  const [replyFor,setReplyFor]=useState<Project|null>(null);
  const [near,setNear]=useState<[number,number]|null>(null);
  const [nearBusy,setNearBusy]=useState(false);
  const [nearErr,setNearErr]=useState<string|null>(null);

  /** The ten nearest contracts to the reader, measured not guessed. */
  const nearest=useMemo(()=>{
    if(!near) return [];
    return projects
      .filter(p=>p.lat!=null&&p.lng!=null)
      .map(p=>({p,m:metresBetween(near,[p.lat!,p.lng!])}))
      .sort((a,b)=>a.m-b.m).slice(0,10);
  },[near,projects]);

  const suggested=suggestEncoding(filters as never);
  const encKey=colorBy??(suggested==="priority"?roleDefault:suggested);
  const enc=ENCODING_BY_KEY.get(encKey)!;
  const legend=useMemo(()=>legendFor(enc,projects),[enc,projects]);
  const [q,setQ]=useState("");
  const sort=useSort<Project>();
  const flagged=projects.filter(p=>p.auditFlags.length>0).length;
  const filtered=useMemo(()=>projects.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.municipality.toLowerCase().includes(q.toLowerCase())),[projects,q]);
  const sorted=useMemo(()=>sort.apply(filtered),[filtered,sort.apply]);
  const pg=usePagination(filtered.length,8);

  const selected=projects.find(p=>p.id===selectedId)??null;
  const nActive=activeCount(filters);

  const SlidePanel=({project}:{project:Project})=>{
    const pr=PROC_BY_ID.get(project.id);
    const hz=HAZARD_BY_ID.get(project.id);
    const sat=SAT_BY_ID.get(project.id);
    const docs=pr?(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[]).filter(k=>pr.documents[k]):[];
    const flags=[...project.auditFlags.map(f=>({...f,label:FLAG_LABELS[f.code]??f.code})),
                 ...(pr?.procurementFlags??[]).map(f=>({...f,label:PROC_FLAG_LABELS[f.code]??f.code}))];
    const saved=pr?.abc&&pr?.awardAmount?pr.abc-pr.awardAmount:null;

    const Section=({title,children}:{title:string;children:React.ReactNode})=>(
      <section className="pt-4 mt-4 border-t border-gray-100 first:pt-0 first:mt-0 first:border-0">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">{title}</h4>
        {children}
      </section>
    );
    const Fact=({l,v,sub}:{l:string;v:React.ReactNode;sub?:string})=>(
      <div className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
        <span className="text-[12px] text-gray-500 shrink-0">{l}</span>
        <span className="text-right">
          <span className="text-[13px] text-gray-900 font-medium">{v}</span>
          {sub&&<span className="block text-[10px] text-gray-400 mt-0.5">{sub}</span>}
        </span>
      </div>
    );
    const dt=(d:string|null|undefined)=>d?new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—";

    return (
      <div className="absolute right-0 top-0 bottom-0 bg-white border-l border-gray-200 shadow-2xl flex flex-col" style={{width:440,zIndex:1000}}>
        <div className="flex items-start gap-2 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono text-gray-400">{project.id}</div>
            <h3 className="text-[14px] font-bold text-gray-900 leading-snug mt-1">{project.name}</h3>
            <div className="text-[12px] text-gray-500 mt-1 flex items-center gap-1"><MapPin size={11}/>{project.municipality}, Bulacan</div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              <StatusBadge status={project.status}/>
              {project.auditFlags.length>0&&(
                <span className="text-[11px] px-2 py-0.5 rounded font-medium flex items-center gap-1" style={{background:tint("#c05621"),color:accent("#c05621")}}>
                  <AlertTriangle size={10}/>Flagged for review
                </span>
              )}
              {hz?.hazard&&hz.hazard!=="none"&&<span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700">{hz.hazard} flood risk</span>}
            </div>
          </div>
          <button onClick={()=>setSelectedId("")} aria-label="Close panel" className="p-1 text-gray-400 hover:text-gray-600 rounded shrink-0"><X size={16}/></button>
        </div>

        {project.lat!=null&&project.lng!=null?(
          <div className="border-b border-gray-100 shrink-0">
            <ProjectMap project={project as Project&{lat:number;lng:number}} enc={enc} onPick={id=>setSelectedId(id)}/>
            <div className="px-5 py-1.5 text-[10px] text-gray-400 flex items-center justify-between">
              <span className="font-mono">{project.lat.toFixed(5)}, {project.lng.toFixed(5)}</span>
              <span>nearby contracts are clickable</span>
            </div>
          </div>
        ):(
          <div className="border-b border-gray-100 px-5 py-6 text-center shrink-0">
            <MapPin size={20} className="text-gray-300 mx-auto mb-1.5"/>
            <div className="text-[12px] text-gray-600 font-medium">No location was published</div>
            <div className="text-[11px] text-gray-400 mt-0.5">so this contract cannot be found on the ground, or checked from a map</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4" style={{scrollbarWidth:"none"}}>
          {/* Something to read before anything to scan. Everything in it is on
              screen elsewhere; the point is a form a person can take in. */}
          <p className="text-[13px] text-gray-700 leading-relaxed mb-3">{plainSummary(project)}</p>

          <details className="mb-3.5 group">
            <summary className="text-[11px] text-[#1e3a7b] cursor-pointer hover:underline">
              Read the full contract description
            </summary>
            <p className="text-[12px] text-gray-600 leading-relaxed mt-1.5 pl-2 border-l-2 border-gray-100">
              {project.description}
            </p>
          </details>

          {/* The three numbers that answer "what did this cost and was it competed" */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            <div className="rounded bg-gray-50 p-2.5">
              <div className="font-mono text-[15px] font-bold text-gray-900">{pr?.awardAmount?peso(pr.awardAmount):"—"}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">awarded</div>
            </div>
            <div className="rounded bg-gray-50 p-2.5">
              <div className="font-mono text-[15px] font-bold" style={{color:pr?.bidRatio&&Math.abs(pr.bidRatio*100-96)<0.01?accent("#c05621"):"var(--color-gray-900)"}}>
                {pr?.bidRatio?`${(pr.bidRatio*100).toFixed(2)}%`:"—"}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">of budget</div>
            </div>
            <div className="rounded bg-gray-50 p-2.5">
              <div className="font-mono text-[15px] font-bold" style={{color:(pr?.bidders??0)===1?accent("#c0272d"):"var(--color-gray-900)"}}>{pr?.bidders??"—"}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{pr?.bidders===1?"bidder":"bidders"}</div>
            </div>
          </div>

          {flags.length>0&&(
            <Section title={`What's flagged — ${flags.length}`}>
              <div className="space-y-2">
                {flags.map(f=>{
                  const sv=SEVERITY_CFG[f.severity];
                  return (
                    <div key={f.code} className="rounded border px-3 py-2.5" style={{background:sv.bg,borderColor:sv.color+"33"}}>
                      <div className="text-[12px] font-semibold mb-1" style={{color:sv.color}}>{f.label}</div>
                      <div className="text-[11px] text-gray-700 leading-relaxed">{f.detail}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-2">
                A flag means the public record disagrees with itself. It is a reason to look,
                not proof that anything was done wrong.
              </p>
            </Section>
          )}

          <Section title="The contract">
            <Fact l="Contractor" v={project.contractor.replace(/\s*\(.*$/,"")}/>
            <Fact l="Approved budget" v={pr?.abc?pesoFull(pr.abc):"—"}/>
            <Fact l="Awarded for" v={pr?.awardAmount?pesoFull(pr.awardAmount):"—"}
              sub={saved?`₱${saved.toLocaleString("en-PH",{maximumFractionDigits:0})} below the approved budget`:undefined}/>
            <Fact l="Reported progress" v={`${project.completion}%`}/>
            {/* What the contract says it covers. The map draws this as a circle;
                the number belongs here so the two agree. */}
            {/* Always shown, including when it is absent. Only 224 of 1,293
                contracts state chainage, and silently omitting the row made a
                missing extent look identical to a page that had not loaded. */}
            <Fact l="Stated extent"
              v={(project as unknown as {lengthMetres?:number|null}).lengthMetres!=null
                ? `${(project as unknown as {lengthMetres:number}).lengthMetres.toLocaleString()} m`
                : <span className="text-gray-400">not published</span>}/>
            {/* The contract's own quantities, split by what can be seen. This
                is the only thing in the panel that says what SHOULD be here
                rather than what the register says about it. */}
            <div className="col-span-2 mt-1"><WhatThePaperSays contractId={project.id}/></div>

            {/* Eye level, where a sky view stops being able to help. */}
            {project.lat!=null&&project.lng!=null&&(
              <div className="col-span-2 mt-1"><StreetLevel lat={project.lat} lng={project.lng}/></div>
            )}
            {/* A route for the people named here to answer. Placed with the
                contract facts rather than buried, because the party best placed
                to correct a coordinate is the firm that built at it. */}
            <div className="col-span-2 mt-1">
              <button onClick={()=>setReplyFor(project)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50">
                <MessageSquareWarning size={12}/>Is something here wrong? Answer this record
              </button>
            </div>
            {/* What the yellow shape on the map is, and how far to trust it. The
                corridor's direction comes from OSM channel geometry, not from
                DPWH, so the channel it was derived from is named and the
                distance to it is given — a corridor built off a channel 300 m
                away is a much weaker claim than one the point sits on. */}
            {(()=>{const sc=SCOPE_BY_ID.get(project.id); if(!sc) return null;
              const weak=sc.metresToWaterway>100;
              return (
                <div className="col-span-2 mt-1 rounded border px-2.5 py-2 text-[11px] leading-relaxed"
                  style={{background:tint("#b45309",10),borderColor:tint("#b45309",34),color:"var(--color-gray-700)"}}>
                  <strong>The yellow shape is an estimate.</strong> {sc.coveredMetres.toLocaleString()} m
                  along {sc.waterwayName?<>the <strong>{sc.waterwayName}</strong></>:<>an unnamed {sc.waterwayClass??"channel"}</>},
                  centred on the published point. The register gives a length but no direction, so the
                  line of it comes from OpenStreetMap, not from DPWH.
                  <div className="mt-1" style={{color:weak?accent("#c0272d"):"var(--color-gray-500)"}}>
                    {weak
                      ? `The nearest mapped channel is ${sc.metresToWaterway} m away — far enough that this corridor may follow the wrong watercourse, and far enough to be worth asking about on its own.`
                      : `Nearest mapped channel is ${sc.metresToWaterway} m from the point.`}
                    {sc.coveredMetres<sc.lengthMetres-20&&` The mapped channel ran out, so ${sc.coveredMetres} m of the stated ${sc.lengthMetres} m is drawn.`}
                  </div>
                </div>
              );})()}
            <Fact l="Funding source" v={<span className="text-[12px]">{project.fundingSource}</span>}/>
          </Section>

          {pr&&pr.bidderList&&pr.bidderList.length>0&&(
            <Section title={`Who bid — ${pr.bidderList.length}`}>
              <div className="space-y-1">
                {pr.bidderList.map((b,i)=>(
                  <div key={`${b.pcab??b.name}-${i}`} className="flex items-baseline gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`text-[12px] flex-1 ${b.won?"font-semibold text-gray-900":"text-gray-600"}`}>{b.name||"(unnamed)"}</span>
                    {b.won&&<span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{background:tint("#046b04"),color:accent("#046b04")}}>won</span>}
                    {b.pcab&&<span className="text-[10px] font-mono text-gray-400 shrink-0">PCAB {b.pcab}</span>}
                  </div>
                ))}
              </div>
              {pr.bidderList.length===1&&(
                <p className="text-[10px] text-gray-400 leading-relaxed mt-2">
                  Nobody else bid. Nationally, 9% of flood-control contracts are awarded
                  without a competing bid.
                </p>
              )}
            </Section>
          )}

          <Section title="Timeline">
            <div className="space-y-0">
              {[["Advertised",pr?.advertisementDate],["Awarded",pr?.dateOfAward],
                ["Started",project.startDate],["Due to finish",project.endDate]].map(([l,d],i,arr)=>(
                <div key={l as string} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{background:d?"#1e3a7b":"#e5e7eb"}}/>
                    {i<arr.length-1&&<div className="w-px flex-1 bg-gray-200 my-0.5"/>}
                  </div>
                  <div className="pb-3 flex-1 flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-gray-500">{l as string}</span>
                    <span className="text-[12px] font-mono text-gray-800">{dt(d as string)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={`Documents — ${docs.length}`}>
            {docs.length?(
              <div className="space-y-1">
                {docs.map(k=>(
                  <a key={k} href={pr!.documents[k]!} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-gray-100 hover:border-[#1e3a7b]/30 hover:bg-blue-50/30 text-[12px] text-gray-700">
                    <FileText size={14} style={{color:"#1e3a7b"}}/><span className="flex-1">{DOC_LABELS[k]}</span><ExternalLink size={11} className="text-gray-300"/>
                  </a>
                ))}
              </div>
            ):<div className="text-[12px] text-gray-400">None published for this contract</div>}
          </Section>

          {(hz||sat)&&(
            <Section title="On the ground">
              {hz&&hz.level!=null&&(
                <Fact l="Flood risk at this spot"
                  v={hz.level>0?`${hz.hazard} hazard`:"outside the flood model"}
                  sub={hz.level===0&&hz.metresToHazard!=null?`${hz.metresToHazard.toLocaleString()} m from the nearest flood-prone area`:undefined}/>
              )}
              {sat&&(
                <div className="mt-2 rounded border px-3 py-2.5" style={{background:tint(VERDICT_CFG[sat.verdict].color),borderColor:tint(VERDICT_CFG[sat.verdict].color,38)}}>
                  <div className="text-[12px] font-semibold mb-1" style={{color:VERDICT_CFG[sat.verdict].color}}>{VERDICT_CFG[sat.verdict].label}</div>
                  <div className="text-[11px] text-gray-600 leading-relaxed">{VERDICT_CFG[sat.verdict].note}</div>
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-gray-100 shrink-0 space-y-2">
          {project.lat!=null&&project.lng!=null&&(
            <div className="flex gap-2">
              <a href={`https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`} target="_blank" rel="noreferrer"
                className="flex-1 py-2 rounded border border-gray-200 text-[12px] text-gray-600 flex items-center justify-center gap-1.5 hover:border-[#1e3a7b]/40 hover:text-[#1e3a7b]">
                <MapPin size={12}/>Navigate
              </a>
              <button onClick={()=>setBriefFor(project)}
                className="flex-1 py-2 rounded border border-gray-200 text-[12px] text-gray-600 flex items-center justify-center gap-1.5 hover:border-[#1e3a7b]/40 hover:text-[#1e3a7b]">
                <FileText size={12}/>Field brief
              </button>
            </div>
          )}
          <button onClick={()=>onViewDetail(project.id)} className="w-full py-2.5 rounded text-[13px] font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90" style={{background:"var(--masid-navy)"}}>Open full record<ArrowRight size={14}/></button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-auto min-h-[44px] bg-white border-b border-gray-200 flex flex-wrap items-center px-4 gap-3 py-2 shrink-0">
        <div className="flex items-center gap-3 text-[13px]">
          <span><span className="font-mono font-bold text-[#1e3a7b]">{filtered.length}</span><span className="text-gray-500"> projects</span></span>
          <span className="w-px h-4 bg-gray-200"/>
          <span className="flex items-center gap-1"><AlertTriangle size={13} className="text-amber-500"/><span className="font-mono font-bold text-amber-600">{flagged}</span><span className="text-gray-400">flagged</span></span>
          {/* Be explicit about what the canvas cannot show, rather than letting
              the marker count quietly disagree with the project count. */}
          <span className="w-px h-4 bg-gray-200"/>
          <span className="text-[11px] text-gray-400" title="Records with no published coordinate, plus coordinates falling outside the drawn extent">
            <span className="font-mono">{PROJECTS.length-META.coverage.withCoordinates+OFF_MAP.length}</span> not mappable
          </span>
        </div>
        {nActive>0&&(
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-400">{nActive} filter{nActive===1?"":"s"} active</span>
            <button onClick={onClearFilters} className="text-[11px] text-[#1e3a7b] hover:underline">clear all</button>
          </div>
        )}
        <div className="flex-1"/>
        {viewMode==="list"&&<div className="relative shrink-0"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter…" aria-label="Filter projects" className="pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 w-48 focus:outline-none focus:border-[#1e3a7b]"/></div>}
        <div className="flex border border-gray-200 rounded overflow-hidden text-[12px] font-medium shrink-0">
          <button onClick={()=>setViewMode("map")} className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewMode==="map"?"bg-[#1e3a7b] text-white":"text-gray-500 hover:bg-gray-50"}`}><MapIcon size={13}/>Map</button>
          <button onClick={()=>setViewMode("list")} className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewMode==="list"?"bg-[#1e3a7b] text-white":"text-gray-500 hover:bg-gray-50"}`}><List size={13}/>List</button>
        </div>
      </div>

      {viewMode==="map"?(
        <div className="flex-1 relative overflow-hidden">
          {/*
            The question an ordinary person actually arrives with.

            Until now the only way in was a contract id or 1,293 rows of table —
            fine for an auditor, useless for someone who wants to know what was
            built on their own barangay's riverbank. The device already knows
            where it is, and every contract has a coordinate, so the answer is
            one tap away and was simply never offered.
          */}
          <button onClick={()=>{
              if(!navigator.geolocation){setNearErr("This browser will not share a location.");return;}
              setNearBusy(true); setNearErr(null);
              navigator.geolocation.getCurrentPosition(
                pos=>{ setNearBusy(false); setNear([pos.coords.latitude,pos.coords.longitude]); },
                ()=>{ setNearBusy(false); setNearErr("Location permission was declined, so nothing can be measured from where you are."); },
                {enableHighAccuracy:true,timeout:10000});
            }}
            className="absolute left-3 bottom-3 flex items-center gap-1.5 px-3 py-2 rounded shadow-lg text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
            style={{background:"var(--masid-navy)",zIndex:900}} disabled={nearBusy}>
            <MapPin size={13}/>{nearBusy?"Finding you…":near?"Update my location":"What is near me?"}
          </button>
          <LeafletMap projects={layers.markers?filtered:[]} enc={enc} selectedId={selectedId}
            onSelect={setSelectedId} showBoundaries={layers.boundaries}
            cluster={layers.cluster}/>
          {(near||nearErr)&&(
            <div className="absolute left-3 bottom-16 bg-white rounded border border-gray-200 shadow-xl overflow-hidden"
              style={{zIndex:900,width:320,maxHeight:"48vh"}}>
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <MapPin size={12} className="text-[#1e3a7b]"/>
                <span className="text-[12px] font-bold text-gray-700">Nearest to you</span>
                <button onClick={()=>{setNear(null);setNearErr(null);}}
                  className="ml-auto p-0.5 text-gray-400 hover:text-gray-600"><X size={13}/></button>
              </div>
              {nearErr?(
                <p className="px-3 py-3 text-[12px] text-gray-600 leading-relaxed">{nearErr}</p>
              ):(
                <div className="overflow-y-auto" style={{maxHeight:"40vh"}}>
                  {nearest.map(({p,m})=>(
                    <button key={p.id} onClick={()=>setSelectedId(p.id)}
                      className="w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{background:colorOf(p,enc)}}/>
                        <span className="font-mono text-[10px] text-gray-500">{p.id}</span>
                        <span className="ml-auto font-mono text-[11px] font-semibold text-gray-700">
                          {m<1000?`${m} m`:`${(m/1000).toFixed(1)} km`}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-700 leading-tight mt-0.5">
                        {p.municipality} · {p.description.slice(0,54)}…
                      </div>
                    </button>
                  ))}
                  {nearest.length===0&&(
                    <p className="px-3 py-3 text-[12px] text-gray-500">
                      No contract in the current filters has a coordinate to measure against.
                    </p>
                  )}
                </div>
              )}
              <p className="px-3 py-2 text-[10px] text-gray-400 leading-relaxed border-t border-gray-100">
                Straight-line distance from your device to the coordinate DPWH published. Your
                location is used in this browser only and is not sent anywhere.
              </p>
            </div>
          )}
          {filtered.length===0&&(
            <div className="absolute inset-0 flex items-center justify-center bg-white/80" style={{zIndex:900}}>
              <EmptyState title="No projects match your filters" body="Try adjusting the status or municipality filters in the sidebar." action="Reset Filters" onAction={onClearFilters}/>
            </div>
          )}
          {selected&&<SlidePanel project={selected}/>}
          {briefFor&&<InspectionBrief project={briefFor} onClose={()=>setBriefFor(null)}/>}
          {replyFor&&<RightOfReply contractId={replyFor.id} contractName={replyFor.name} onClose={()=>setReplyFor(null)}/>}
        </div>
      ):(
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {filtered.length===0?(
              <EmptyState title="No projects found" body={q?`No results for "${q}"`:"No projects match the current filters."} action={q?"Clear search":undefined} onAction={q?()=>setQ(""):undefined}/>
            ):(
              <div className="overflow-x-auto">
                {/* Scrolls rather than clips. The card around this table is
                    overflow-hidden, so on a 390px phone columns four onward were
                    not merely cramped, they were invisible and unreachable. */}
              <table className="w-full text-[13px] border-collapse min-w-[760px]">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <SortTh col={"name" as keyof Project}         label="Project"      sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"municipality" as keyof Project} label="Municipality" sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"contractor" as keyof Project}   label="Contractor"   sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"budget" as keyof Project}       label="Budget"       sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"completion" as keyof Project}   label="Progress"     sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"status" as keyof Project}       label="Status"       sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <th className="px-4 py-2.5"/>
                  </tr>
                </thead>
                <tbody>
                  {pg.paginate(sorted).map(p=>(
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3"><div className="font-semibold text-gray-900">{p.name}</div><div className="text-[11px] font-mono text-gray-400">{p.id}</div></td>
                      <td className="px-4 py-3 text-gray-600">{p.municipality}</td>
                      <td className="px-4 py-3 text-gray-600">{p.contractor}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">{peso(p.budget)}</td>
                      <td className="px-4 py-3 min-w-[120px]"><div className="flex items-center gap-2"><div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${p.completion}%`,background:STATUS_CFG[p.status].dot}}/></div><span className="font-mono text-[11px] text-gray-500 w-7 text-right">{p.completion}%</span></div></td>
                      <td className="px-4 py-3"><StatusBadge status={p.status}/></td>
                      <td className="px-4 py-3"><button onClick={()=>onViewDetail(p.id)} className="text-[#1e3a7b] text-[12px] flex items-center gap-1 hover:underline font-medium">View<ArrowRight size={11}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
          <Pagination page={pg.page} totalPages={Math.ceil(filtered.length/pg.pageSize)} setPage={pg.setPage} total={filtered.length} pageSize={pg.pageSize}/>
        </div>
      )}
    </div>
  );
}

// ─── Project Detail Screen ────────────────────────────────────────────────────

function ProjectDetailScreen({project,onBack,onOpenSatellite}:{project:Project;onBack:()=>void;onOpenSatellite:()=>void}) {
  const [tab,setTab]=useState<"documents"|"satellite"|"reports">("documents");
  const c=STATUS_CFG[project.status];
  // The transparency portal publishes no documents, no inspection records and
  // no geotagged photos. Rather than mint plausible filenames, these panels state
  // what is missing and which part of the data request would supply it.
  const citizenReports=project.reportCount;
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 shrink-0" aria-label="breadcrumb">
        <div className="flex items-start gap-3">
          <button onClick={onBack} aria-label="Back to map" className="mt-1 p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 shrink-0"><ChevronLeft size={17}/></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-2 font-medium">
              <button onClick={onBack} className="hover:text-[#1e3a7b] hover:underline">Map</button>
              <ChevronRight size={12}/>
              <span className="text-gray-600">{project.id}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5"><span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{project.id}</span><StatusBadge status={project.status} size="md"/></div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{project.name}</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">{project.municipality}, Province of Bulacan · {project.districtOffice}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-2 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><Download size={13}/>Export</button>
            <button onClick={()=>toast.success("Edit mode enabled")} className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-white rounded hover:opacity-90" style={{background:"var(--masid-navy)"}}><Edit2 size={13}/>Edit</button>
          </div>
        </div>
        {project.auditFlags.length>0&&<div className="ml-11 mt-3"><AuditFlags project={project}/></div>}
        {(()=>{
          const pr=PROC_BY_ID.get(project.id);
          if(!pr||!pr.procurementFlags.length) return null;
          return (
            <div className="ml-11 mt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <Banknote size={11}/>Procurement signal
                <span className="font-mono bg-gray-100 text-gray-500 px-1.5 rounded normal-case tracking-normal">{pr.matchConfidence} match</span>
              </div>
              {pr.procurementFlags.map(f=>{
                const sv=SEVERITY_CFG[f.severity];
                return (
                  <div key={f.code} className="rounded border p-2.5 text-[11px]" style={{background:sv.bg,borderColor:sv.color+"33",color:sv.color}}>
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote size={11}/><span className="font-semibold">{PROC_FLAG_LABELS[f.code]??f.code}</span>
                      <span className="ml-auto font-mono text-[9px] uppercase tracking-wider opacity-70">{sv.label}</span>
                    </div>
                    <div className="text-gray-700 leading-relaxed">{f.detail}</div>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-400 leading-relaxed">
                From PhilGEPS award records, joined on contractor name and contract amount.
                PhilGEPS publishes no bidder counts, so single-bidder and bid-to-budget
                indicators are absent rather than estimated.
              </p>
            </div>
          );
        })()}
      </nav>
      <div className="flex-1 overflow-auto p-6" style={{scrollbarWidth:"none"}}>
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-5">
          <div className="space-y-4">
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50"><span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Project Information</span></div>
              <dl className="p-4 space-y-3.5">
                {[{l:"Contractor",v:project.contractor},{l:"Municipality",v:`${project.municipality}, Bulacan`},{l:"Funding Source",v:project.fundingSource}].map(({l,v})=>(<div key={l}><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">{l}</dt><dd className="text-[13px] font-medium text-gray-800">{v}</dd></div>))}
                <div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Contract Amount</dt><dd className="text-[17px] font-mono font-bold text-gray-900">{pesoFull(project.budget)}</dd></div>
                <div><div className="flex items-center justify-between mb-1.5"><span className="text-[10px] text-gray-400 uppercase tracking-wider" title="The percentage DPWH publishes. Not an observation of the site.">Reported progress</span><span className="text-[13px] font-mono font-bold" style={{color:c.dot}}>{project.completion}%</span></div><div className="w-full bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={project.completion} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full" style={{width:`${project.completion}%`,background:c.dot}}/></div></div>
                {/* What the contract claims to cover. The detail map draws this
                    as a circle; the number belongs beside it so the two agree. */}
                <div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Stated extent</dt>
                  <dd className="text-[13px] font-mono text-gray-800">
                    {(project as unknown as {lengthMetres?:number|null}).lengthMetres!=null?(<>
                      {(project as unknown as {lengthMetres:number}).lengthMetres.toLocaleString()} m
                      {(project as unknown as {stationFrom?:string|null}).stationFrom&&(
                        <span className="text-[11px] text-gray-400 ml-1.5">
                          STA {(project as unknown as {stationFrom:string}).stationFrom} → {(project as unknown as {stationTo:string}).stationTo}
                        </span>
                      )}
                    </>):<span className="text-[12px] text-gray-400">not published</span>}
                  </dd></div>
                <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Start (NTP)</dt><dd className="text-[12px] font-mono text-gray-700">{project.startDate??"—"}</dd></div><div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Target End</dt><dd className="text-[12px] font-mono text-gray-700">{project.endDate??"—"}</dd></div></div>
              </dl>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded border border-gray-200 p-3"><div className="font-mono text-2xl font-bold text-gray-300">—</div><div className="text-[11px] text-gray-400 mt-0.5">Documents (not published)</div></div>
              <div className="bg-white rounded border border-gray-200 p-3"><div className="font-mono text-2xl font-bold" style={{color:citizenReports?"#1e3a7b":"#d1d5db"}}>{citizenReports||"—"}</div><div className="text-[11px] text-gray-400 mt-0.5">Citizen Reports</div></div>
            </div>
          </div>
          <div className="col-span-2 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-gray-200 shrink-0" role="tablist">
              {([["Documents","documents",<FileText size={13}/>],["Satellite Imagery","satellite",<Satellite size={13}/>],["Citizen Reports","reports",<MessageSquare size={13}/>]]as[string,typeof tab,React.ReactNode][]).map(([label,key,icon])=>(
                <button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}
                  className={`flex items-center gap-2 px-5 py-3 text-[13px] font-medium border-b-2 transition-colors ${tab===key?"border-[#1e3a7b] text-[#1e3a7b]":"border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-5" role="tabpanel" style={{scrollbarWidth:"none"}}>
              {tab==="documents"&&(()=>{
                const pr=PROC_BY_ID.get(project.id);
                const have=pr?(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[]).filter(k=>pr.documents[k]):[];
                if(!have.length) return (
                  <div className="max-w-xl">
                    <EmptyState title="No documents published for this contract" body="This contract is one of the few without a published document. Roughly 95% of contracts at this office do publish the invitation to bid, contract agreement, notice of award and notice to proceed."/>
                  </div>
                );
                return (
                  <div className="max-w-2xl space-y-2">
                    {have.map(k=>(
                      <a key={k} href={pr!.documents[k]!} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 p-3 border border-gray-100 rounded hover:border-[#1e3a7b]/30 hover:bg-blue-50/30 transition-colors">
                        <FileText size={17} style={{color:"#1e3a7b"}} className="shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-gray-800">{DOC_LABELS[k]}</div>
                          <div className="text-[10px] font-mono text-gray-400 truncate">{pr!.documents[k]!.split("/").pop()}</div>
                        </div>
                        <ExternalLink size={13} className="text-gray-300 shrink-0"/>
                      </a>
                    ))}
                    <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                      Published by DPWH and served from dcs.infrawatch.ph. Program of work and
                      engineering design are not published for any contract at this office.
                    </p>
                  </div>
                );
              })()}
              {tab==="satellite"&&(()=>{
                const sat=SAT_BY_ID.get(project.id);
                if(!sat) return (
                  <div className="max-w-xl">
                    <EmptyState title="Not in the assessed subset" body={`The satellite tier runs on an audit-priority selection plus a seeded control sample — ${SATELLITE.coverage.assessed} of ${SATELLITE.coverage.total.toLocaleString()} records so far. Open Satellite Monitoring for how to extend it.`}/>
                  </div>
                );
                const cfg=VERDICT_CFG[sat.verdict];
                const r30=sat.rings.r30, r150=sat.rings.r150;
                return (
                  <div className="max-w-2xl space-y-4">
                    <div className="rounded border p-3.5" style={{background:tint(cfg.color),borderColor:tint(cfg.color,42)}}>
                      <div className="text-[12px] font-bold mb-1" style={{color:cfg.color}}>{cfg.label}</div>
                      <p className="text-[12px] text-gray-700 leading-relaxed">{sat.detail}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {l:"At 30 m",  v:r30?`${r30.zNdvi>=0?"+":""}${r30.zNdvi.toFixed(1)}σ / ${r30.zNdbi>=0?"+":""}${r30.zNdbi.toFixed(1)}σ`:"—"},
                        {l:"At 150 m", v:r150?`${r150.zNdvi>=0?"+":""}${r150.zNdvi.toFixed(1)}σ / ${r150.zNdbi>=0?"+":""}${r150.zNdbi.toFixed(1)}σ`:"—"},
                        {l:"Cloud-free", v:`${Math.round(sat.cloudFreeFraction*100)}%`},
                      ].map(({l,v})=>(
                        <div key={l} className="bg-gray-50 rounded p-3">
                          <div className="font-mono text-[13px] font-bold text-gray-800">{v}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{l}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{cfg.note}</p>
                    <button onClick={onOpenSatellite} className="text-[13px] font-medium text-[#1e3a7b] flex items-center gap-1.5 hover:underline"><Satellite size={14}/>Open full assessment →</button>
                  </div>
                );
              })()}
              {tab==="reports"&&(
                <div className="max-w-xl">
                  {citizenReports>0
                    ? <div className="border border-gray-200 rounded p-4 text-[13px] text-gray-600">DPWH records <span className="font-mono font-bold text-[#1e3a7b]">{citizenReports}</span> citizen report{citizenReports===1?"":"s"} against this contract. The portal publishes the count but not the report contents.</div>
                    : <EmptyState title="No citizen reports recorded" body="DPWH records no citizen reports against this contract. Across all 1,293 records in this district only 4 carry any report at all, so absence here says more about reporting reach than about the project."/>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Satellite Screen ─────────────────────────────────────────────────────────

// SatelliteScreen now lives in src/app/SatelliteScreen.tsx — a browsable
// workbench rather than a view that only worked if you arrived carrying a
// selection.

// ─── Documents Screen ─────────────────────────────────────────────────────────

function DocumentsScreen() {
  // This screen previously stated that DPWH publishes no contract documents.
  // That was wrong: the claim came from reading the flat export, which drops the
  // link columns. 99.5% of contracts at this office carry at least one live
  // document URL, and a sampled dozen were confirmed to resolve.
  const [q,setQ]=useState("");
  const rows=useMemo(()=>PROCUREMENT.results
    .map(r=>({r, p:PROJECTS.find(x=>x.id===r.id)}))
    .filter(({r,p})=>p&&Object.values(r.documents).some(Boolean)&&
      (!q||r.id.toLowerCase().includes(q.toLowerCase())||p!.description.toLowerCase().includes(q.toLowerCase())))
  ,[q]);
  const pg=usePagination(rows.length,12);
  const counts=(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[])
    .map(k=>({k,n:PROCUREMENT.results.filter(r=>r.documents[k]).length}));
  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{scrollbarWidth:"none"}}>
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Contract Documents</h1>
          <p className="text-[13px] text-gray-500">{PROCUREMENT.office.documentsPublished.toLocaleString()} of {PROJECTS.length.toLocaleString()} contracts publish at least one document · served by dcs.infrawatch.ph</p>
        </div>
        <div className="ml-auto relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={q} onChange={e=>{setQ(e.target.value);pg.setPage(1);}} placeholder="Search contract ID or description…" className="pl-7 pr-3 py-2 text-[12px] border border-gray-200 rounded bg-gray-50 w-72 focus:outline-none focus:border-[#1e3a7b]"/>
        </div>
      </div>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-6 gap-3">
          {counts.map(({k,n})=>(
            <div key={k} className="bg-white rounded border border-gray-200 p-3">
              <div className="font-mono text-xl font-bold" style={{color:n?"#1e3a7b":"#cbd5e1"}}>{n.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{DOC_LABELS[k]}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Program of work and engineering design are empty on every contract at this office —
          those remain the genuine gap, and are sections 1C of the consolidated data request.
          The invitation-to-bid bundle is a .zip that typically contains the bill of quantities
          and plans.
        </p>
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            {/* Scrolls rather than clips. The card around this table is
                overflow-hidden, so on a 390px phone columns four onward were
                not merely cramped, they were invisible and unreachable. */}
          <table className="w-full text-[12px] min-w-[760px]">
            <thead><tr className="border-b border-gray-100 bg-gray-50">{["Contract","Description","Award","Documents"].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {pg.paginate(rows).map(({r,p})=>(
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 align-top">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-gray-600 align-middle">{r.id}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-sm truncate" title={p!.description}>{p!.description}</td>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap align-middle">{r.awardAmount?peso(r.awardAmount):"—"}</td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[]).filter(k=>r.documents[k]).map(k=>(
                        <a key={k} href={r.documents[k]!} target="_blank" rel="noreferrer"
                          title={DOC_LABELS[k]}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-[#1e3a7b] hover:bg-blue-50 hover:border-[#1e3a7b]/30 flex items-center gap-1">
                          <FileText size={9}/>{DOC_LABELS[k].replace("Invitation to bid, BOQ and plans","Bid docs").replace("Contract agreement","Contract").replace("Notice of award","NOA").replace("Notice to proceed","NTP")}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination page={pg.page} totalPages={Math.ceil(rows.length/pg.pageSize)} setPage={pg.setPage} total={rows.length} pageSize={pg.pageSize}/>
        </div>
      </div>
    </div>
  );
}

// Lost in an over-wide slice when the satellite screen was extracted, and only
// surfaced by clicking the tab — the build passed the whole time.
function ContractorsScreen() {
  const [q,setQ]=useState("");
  const [selected,setSelected]=useState<Contractor|null>(null);
  const sort=useSort<Contractor>();
  const filtered=useMemo(()=>CONTRACTORS.filter(c=>!q||c.name.toLowerCase().includes(q.toLowerCase())||c.municipalities.some(m=>m.toLowerCase().includes(q.toLowerCase()))),[q]);
  const sorted=useMemo(()=>sort.apply(filtered),[filtered,sort.apply]);
  const pg=usePagination(filtered.length,8);
  // PCAB licence class, GPPB blacklisting and performance ratings are not in any
  // public dataset, so this registry carries only what the award records prove:
  // who won what, where, when, and how often their records fail a check.
  const FlagRate=({rate}:{rate:number})=>{
    const c=rate>=0.5?"#b91c1c":rate>=0.25?"#b45309":"#15803d";
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${Math.max(rate*100,rate>0?4:0)}%`,background:c}}/></div>
        <span className="font-mono text-[11px]" style={{color:c}}>{Math.round(rate*100)}%</span>
      </div>
    );
  };
  return (
    <div className="flex-1 flex overflow-hidden bg-white">
      <div className={`flex flex-col border-r border-gray-200 ${selected?"w-3/5":"flex-1"}`}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <h2 className="text-[14px] font-bold text-gray-900">Contractor Registry</h2>
          <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{CONTRACTORS.length}</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or municipality…" aria-label="Search contractors" className="pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 w-52 focus:outline-none focus:border-[#1e3a7b]"/></div>
            <span className="text-[11px] text-gray-400">Derived from award records · rebuild with <code className="font-mono">pipeline/build_dataset.py</code></span>
          </div>
        </div>
        <div className="flex-1 overflow-auto" style={{scrollbarWidth:"none"}}>
          {filtered.length===0?<EmptyState title="No contractors found" body={`No results for "${q}"`} action="Clear search" onAction={()=>setQ("")}/>:(
            <div className="overflow-x-auto">
              {/* Scrolls rather than clips. The card around this table is
                  overflow-hidden, so on a 390px phone columns four onward were
                  not merely cramped, they were invisible and unreachable. */}
            <table className="w-full text-[12px] min-w-[760px]">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <SortTh col={"name" as keyof Contractor}           label="Contractor"     sortKey={sort.sortKey as keyof Contractor|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Contractor)=>void}/>
                  <SortTh col={"totalProjects" as keyof Contractor}  label="Contracts"      sortKey={sort.sortKey as keyof Contractor|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Contractor)=>void}/>
                  <SortTh col={"totalValue" as keyof Contractor}     label="Total Value"    sortKey={sort.sortKey as keyof Contractor|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Contractor)=>void}/>
                  <SortTh col={"activeProjects" as keyof Contractor} label="Ongoing"        sortKey={sort.sortKey as keyof Contractor|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Contractor)=>void}/>
                  <SortTh col={"flaggedProjects" as keyof Contractor} label="Flagged"       sortKey={sort.sortKey as keyof Contractor|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Contractor)=>void}/>
                  <SortTh col={"flagRate" as keyof Contractor}       label="Flag Rate"      sortKey={sort.sortKey as keyof Contractor|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Contractor)=>void}/>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Years</th>
                  <th className="px-4 py-2.5"/>
                </tr>
              </thead>
              <tbody>
                {pg.paginate(sorted).map(c=>{
                  return (
                    <tr key={c.id} onClick={()=>setSelected(selected?.id===c.id?null:c)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${selected?.id===c.id?"bg-blue-50":"hover:bg-gray-50"}`}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{c.name}
                        {c.registrationRevoked&&<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-50 text-red-700 align-middle">REVOKED</span>}</td>
                      <td className="px-4 py-3 font-mono text-center">{c.totalProjects}</td>
                      <td className="px-4 py-3 font-mono">{peso(c.totalValue)}</td>
                      <td className="px-4 py-3 font-mono text-center">{c.activeProjects}</td>
                      <td className="px-4 py-3 font-mono text-center">{c.flaggedProjects}</td>
                      <td className="px-4 py-3"><FlagRate rate={c.flagRate}/></td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{c.years.length?`${c.years[0]}–${c.years[c.years.length-1]}`:"—"}</td>
                      <td className="px-4 py-3"><button className="text-[#1e3a7b] text-[11px] flex items-center gap-1 hover:underline font-medium">View<ArrowRight size={10}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
        <Pagination page={pg.page} totalPages={Math.ceil(filtered.length/pg.pageSize)} setPage={pg.setPage} total={filtered.length} pageSize={pg.pageSize}/>
      </div>
      {selected&&(
        <div className="w-2/5 flex flex-col bg-white border-l border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <span className="text-[12px] font-bold text-gray-700">{selected.name}</span>
            <button onClick={()=>setSelected(null)} aria-label="Close detail panel"><X size={15} className="text-gray-400 hover:text-gray-600"/></button>
          </div>
          <div className="flex-1 overflow-auto p-5 space-y-4" style={{scrollbarWidth:"none"}}>
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Award Record</div>
              <dl className="space-y-2.5">{[
                {l:"Contracts won",v:String(selected.totalProjects)},
                {l:"Total awarded",v:pesoFull(selected.totalValue),m:true},
                {l:"Years active",v:selected.years.length?`${selected.years[0]}–${selected.years[selected.years.length-1]}`:"—",m:true},
                {l:"Municipalities",v:String(selected.municipalities.length)},
                {l:"Registration",v:selected.registrationRevoked?"Marked REVOKED by DPWH":"No marker in DPWH record"},
              ].map(({l,v,m})=>(<div key={l} className="flex items-start gap-2 justify-between"><dt className="text-[12px] text-gray-500">{l}</dt><dd className={`text-[12px] font-medium text-gray-800 text-right ${m?"font-mono":""}`}>{v}</dd></div>))}</dl>
              <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">PCAB licence class, GPPB blacklisting and performance ratings are not published in any open dataset. They are absent rather than estimated.</p>
            </div>
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Record Quality</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 rounded p-3"><div className="font-mono text-xl font-bold" style={{color:"#1e3a7b"}}>{selected.activeProjects}</div><div className="text-[10px] text-gray-400">Ongoing</div></div>
                <div className="bg-gray-50 rounded p-3"><div className="font-mono text-xl font-bold text-green-700">{selected.completedProjects}</div><div className="text-[10px] text-gray-400">Completed</div></div>
                <div className="bg-gray-50 rounded p-3"><div className="font-mono text-xl font-bold text-amber-600">{selected.flaggedProjects}</div><div className="text-[10px] text-gray-400">Flagged</div></div>
              </div>
              <div className="text-[11px] text-gray-500 mb-1.5">Share of this contractor&apos;s records tripping a consistency check</div>
              <FlagRate rate={selected.flagRate}/>
            </div>
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50"><span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Linked Projects</span></div>
              {PROJECTS.filter(p=>p.contractor===selected.name).length===0?<EmptyState title="No linked projects" body="No projects found in MASID for this contractor."/>:PROJECTS.filter(p=>p.contractor===selected.name).map(p=>(
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"><div className="flex-1 min-w-0"><div className="text-[12px] font-medium text-gray-800 truncate">{p.name}</div><div className="text-[10px] font-mono text-gray-400">{p.id}</div></div><StatusBadge status={p.status}/></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Admin Screen ─────────────────────────────────────────────────────────────

function AdminScreen() {
  const [tab,setTab]=useState<"users"|"audit"|"integrations">("users");
  const [confirm,setConfirm]=useState<{title:string;body:string;onConfirm:()=>void}|null>(null);
  const ROLE_LABELS:Record<Role,string>={"dpwh-admin":"DPWH Admin","dpwh-engineer":"DPWH Engineer","field-inspector":"Field Inspector","psa-analyst":"PSA Analyst","lgu-coordinator":"LGU Coordinator","public":"Public"};
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {confirm&&<ConfirmDialog {...confirm} danger onCancel={()=>setConfirm(null)}/>}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center gap-4">
        <Settings size={18} style={{color:"#1e3a7b"}}/>
        <div><div className="text-[14px] font-bold text-gray-900">System Administration</div><div className="text-[12px] text-gray-500">User management · Audit trail · Integration status</div></div>
        <div className="ml-auto flex items-center gap-3 border-l border-gray-100 pl-4">
          {[{l:String(PROJECTS.length),s:"Projects",bg:"#eef2f9",c:"#1e3a7b"},{l:String(SYSTEM_USERS.length),s:"Users",bg:"#f0fdf4",c:"#15803d"},{l:String(PROJECTS.filter(p=>p.status==="flagged").length),s:"Flagged",bg:"#fffbeb",c:"#b45309"},{l:"5/8",s:"Integrations",bg:"#eff6ff",c:"#1d4ed8"}].map(k=>(
            <div key={k.s} className="rounded px-3 py-1.5 text-center" style={{background:k.bg}}><div className="font-mono font-bold text-sm" style={{color:k.c}}>{k.l}</div><div className="text-[9px] text-gray-500">{k.s}</div></div>
          ))}
        </div>
      </div>
      <div className="flex border-b border-gray-200 bg-white px-6" role="tablist">
        {([["users","Users",<Users size={13}/>],["audit","Audit Log",<Activity size={13}/>],["integrations","Integrations",<Wifi size={13}/>]]as[typeof tab,string,React.ReactNode][]).map(([key,label,icon])=>(
          <button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${tab===key?"border-[#1e3a7b] text-[#1e3a7b]":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6" style={{scrollbarWidth:"none"}} role="tabpanel">
        {tab==="users"&&(
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <span className="text-[13px] font-bold text-gray-800">System Users</span>
              <button onClick={()=>toast.success("Invite sent")} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-white rounded hover:opacity-90" style={{background:"var(--masid-navy)"}}><Plus size={13}/>Invite User</button>
            </div>
            <div className="overflow-x-auto">
              {/* Scrolls rather than clips. The card around this table is
                  overflow-hidden, so on a 390px phone columns four onward were
                  not merely cramped, they were invisible and unreachable. */}
            <table className="w-full text-[13px] min-w-[760px]">
              <thead className="border-b border-gray-100 bg-gray-50"><tr>{["Name","Role","Email","Last Login","Status","Actions"].map(h=><th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {SYSTEM_USERS.map((u,i)=>(
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{background:"var(--masid-navy)"}}>{u.name[0]}</div><span className="font-medium text-gray-800">{u.name}</span></div></td>
                    <td className="px-5 py-3"><span className="text-[11px] px-2 py-0.5 rounded font-medium text-white" style={{background:ROLE_CFG[u.role].bg}}>{ROLE_LABELS[u.role]}</span></td>
                    <td className="px-5 py-3 font-mono text-[12px] text-gray-600">{u.email}</td>
                    <td className="px-5 py-3 text-gray-500 text-[12px]">{u.lastLogin}</td>
                    <td className="px-5 py-3"><span className={`text-[11px] px-2 py-0.5 rounded font-medium capitalize ${u.status==="active"?"bg-green-50 text-green-700":u.status==="inactive"?"bg-gray-100 text-gray-500":"bg-red-50 text-red-700"}`}>{u.status}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2">
                      <button onClick={()=>toast.success(`Editing ${u.name}`)} className="text-[12px] text-[#1e3a7b] hover:underline">Edit</button>
                      <span className="text-gray-200">·</span>
                      <button onClick={()=>setConfirm({title:`${u.status==="suspended"?"Restore":"Suspend"} ${u.name}?`,body:`This will ${u.status==="suspended"?"restore access for":"suspend"} ${u.name} (${u.email}).`,onConfirm:()=>toast.warning(`${u.name} ${u.status==="suspended"?"restored":"suspended"}`)})} className="text-[12px] text-red-500 hover:underline">{u.status==="suspended"?"Restore":"Suspend"}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
        {tab==="audit"&&(
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <span className="text-[13px] font-bold text-gray-800">Audit Trail</span>
              <button onClick={()=>toast.success("Audit log exported")} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><Download size={13}/>Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              {/* Scrolls rather than clips. The card around this table is
                  overflow-hidden, so on a 390px phone columns four onward were
                  not merely cramped, they were invisible and unreachable. */}
            <table className="w-full text-[12px] min-w-[760px]">
              <thead className="border-b border-gray-100 bg-gray-50"><tr>{["Timestamp","User","Action","Target","IP Address"].map(h=><th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>{AUDIT_LOG.map((e,i)=><tr key={i} className="border-b border-gray-50 hover:bg-gray-50"><td className="px-5 py-3 font-mono text-gray-500 whitespace-nowrap">{e.time}</td><td className="px-5 py-3 font-medium text-gray-700">{e.user}</td><td className="px-5 py-3 text-gray-600">{e.action}</td><td className="px-5 py-3 font-mono text-[11px] text-[#1e3a7b]">{e.target}</td><td className="px-5 py-3 font-mono text-gray-400">{e.ip}</td></tr>)}</tbody>
            </table>
            </div>
          </div>
        )}
        {tab==="integrations"&&(
          <div className="grid grid-cols-2 gap-4">
            {INTEGRATIONS.map(s=>{const col=s.status==="live"?"#16a34a":s.status==="degraded"?"#f59e0b":"#dc2626";return(
              <div key={s.name} className="bg-white rounded border border-gray-200 p-4 flex items-center gap-4">
                <div className="text-2xl">{s.icon}</div>
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-gray-800">{s.name}</div><div className="text-[11px] font-mono text-gray-400 mt-0.5">Last sync: {s.lastSync}</div></div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.status==="live"?<Wifi size={14} style={{color:col}}/>:<WifiOff size={14} style={{color:col}}/>}
                  <span className="text-[11px] font-semibold capitalize" style={{color:col}}>{s.status}</span>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transparency Screen ──────────────────────────────────────────────────────

function TransparencyScreen({onLogin}:{onLogin:()=>void}) {
  const [q,setQ]=useState("");
  const sort=useSort<Project>();
  const filtered=useMemo(()=>PROJECTS.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.municipality.toLowerCase().includes(q.toLowerCase())),[q]);
  const sorted=useMemo(()=>sort.apply(filtered),[filtered,sort.apply]);
  const pg=usePagination(filtered.length,10);
  const totalBudget=PROJECTS.reduce((s,p)=>s+p.budget,0);
  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{scrollbarWidth:"none"}}>
      <div className="border-b border-amber-200 px-6 py-3 flex items-center gap-3 text-[13px]" style={{background:tint("#f59e0b")}}>
        <Globe size={15} className="text-amber-600"/>
        <span className="text-amber-800"><strong>Public Transparency Portal</strong> — No login required. DPWH Region III · Open Government Partnership.</span>
        <button onClick={onLogin} className="ml-auto text-[12px] font-semibold text-[#1e3a7b] flex items-center gap-1 hover:underline shrink-0">Sign in for full access<ArrowRight size={11}/></button>
      </div>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5"><div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{background:"#f59e0b"}}><Shield size={16} style={{color:"#1e3a7b"}}/></div><div><div className="text-xl font-bold text-gray-900">Flood Control Projects — Province of Bulacan</div><div className="text-[13px] text-gray-500">DPWH Region III · Open Data · FOI-Compliant (EO No. 2)</div></div></div>
          <div className="grid grid-cols-4 gap-4">
            {[{l:"Total Projects",v:String(PROJECTS.length),s:"Bulacan Province",c:"#1e3a7b"},{l:"Total Budget",v:peso(totalBudget),s:"Combined contract value",c:"#16a34a"},{l:"Completed",v:String(PROJECTS.filter(p=>p.status==="completed").length),s:`${Math.round(PROJECTS.filter(p=>p.status==="completed").length/PROJECTS.length*100)}% completion rate`,c:"#16a34a"},{l:"Under Review",v:String(PROJECTS.filter(p=>p.status==="flagged").length),s:"Flagged for investigation",c:"#f59e0b"}].map(k=>(
              <div key={k.l} className="bg-white border border-gray-200 rounded p-4"><div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{k.l}</div><div className="font-mono font-bold text-2xl" style={{color:k.c}}>{k.v}</div><div className="text-[11px] text-gray-500 mt-0.5">{k.s}</div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-8 py-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>{setQ(e.target.value);pg.reset();}} placeholder="Search by name or municipality…" aria-label="Search projects" className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]"/></div>
          <span className="text-[13px] text-gray-500">{filtered.length} of {PROJECTS.length} projects</span>
        </div>
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            {/* Scrolls rather than clips. The card around this table is
                overflow-hidden, so on a 390px phone columns four onward were
                not merely cramped, they were invisible and unreachable. */}
          <table className="w-full text-[13px] min-w-[760px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <SortTh col={"name" as keyof Project}         label="Project Name"  sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"municipality" as keyof Project} label="Municipality"  sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"contractor" as keyof Project}   label="Contractor"    sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"budget" as keyof Project}       label="Budget"        sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"completion" as keyof Project}   label="Progress"      sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"status" as keyof Project}       label="Status"        sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
              </tr>
            </thead>
            <tbody>
              {pg.paginate(sorted).length===0?(<tr><td colSpan={6}><EmptyState title="No projects found" body={`No results for "${q}"`}/></td></tr>):pg.paginate(sorted).map(p=>(
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5"><div className="font-semibold text-gray-900">{p.name}</div><div className="text-[11px] font-mono text-gray-400 mt-0.5">{p.id} · {p.fundingSource}</div></td>
                  <td className="px-5 py-3.5 text-gray-600">{p.municipality}</td>
                  <td className="px-5 py-3.5 text-gray-600">{p.contractor}</td>
                  <td className="px-5 py-3.5 font-mono font-semibold text-gray-800 whitespace-nowrap">{pesoFull(p.budget)}</td>
                  <td className="px-5 py-3.5 min-w-[140px]"><div className="flex items-center gap-2"><div className="flex-1 bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={p.completion} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full" style={{width:`${p.completion}%`,background:STATUS_CFG[p.status].dot}}/></div><span className="font-mono text-[11px] text-gray-500 w-8 text-right">{p.completion}%</span></div></td>
                  <td className="px-5 py-3.5"><StatusBadge status={p.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination page={pg.page} totalPages={Math.ceil(filtered.length/pg.pageSize)} setPage={pg.setPage} total={filtered.length} pageSize={pg.pageSize}/>
        </div>
        <div className="bg-white rounded border border-gray-200 p-6">
          <div className="flex items-start gap-3">
            <CheckSquare size={18} className="text-[#1e3a7b] shrink-0 mt-0.5"/>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-gray-900 mb-1">Freedom of Information (FOI) Request</div>
              <p className="text-[13px] text-gray-500 mb-4">Request project documents under Executive Order No. 2.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input placeholder="Your full name" aria-label="Full name" className="px-3 py-2 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]"/>
                <input placeholder="Email address" type="email" aria-label="Email address" className="px-3 py-2 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]"/>
              </div>
              <textarea rows={3} placeholder="Describe the information you are requesting and the reason for your request…" aria-label="FOI request description" className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b] resize-none mb-3"/>
              <button onClick={()=>toast.success("FOI request submitted. Response within 15 working days.")} className="px-5 py-2.5 text-[13px] font-semibold text-white rounded hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#1e3a7b] focus:ring-offset-2" style={{background:"var(--masid-navy)"}}>Submit FOI Request</button>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-gray-400 pb-4">Data updated daily · Philippine FOI Program · Open Government Partnership · DICT Open Data Portal</p>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [isLoggedIn,setIsLoggedIn]    = useState(false);
  const [userRole,setUserRole]        = useState<Role>("dpwh-admin");
  const [screen,setScreen]            = useState<Screen>("dashboard");
  const [sidebarCollapsed,setSidebar] = useState(false);
  // Null until someone picks one. Seeding it with PROJECTS[0] meant every screen
  // that reads a "selected" project was handed an arbitrary contract nobody
  // chose — the satellite workbench opened on it instead of on the top of its
  // own sorted queue. Screens that need a fallback still apply one below.
  const [selectedProjectId,setSelId]  = useState<string|null>(null);

  /* Theme. Applied before anything is measured so the first paint is already in
     the right palette, and kept in a ref-free closure the system listener reads
     at fire time rather than capturing. */
  const [theme,setThemeState] = useState<Theme>(()=>loadTheme());
  const themeRef = useRef(theme); themeRef.current = theme;
  useEffect(()=>{ applyTheme(theme); saveTheme(theme); },[theme]);
  useEffect(()=>watchSystem(()=>themeRef.current),[]);
  const setTheme = (t:Theme)=>setThemeState(t);

  /* Language. Filipino by default on a device set to Filipino, without asking. */
  const [lang,setLangState] = useState<Lang>(()=>loadLang());
  useEffect(()=>{ saveLang(lang); document.documentElement.lang = lang==="fil"?"fil":"en"; },[lang]);
  const setLang = (l:Lang)=>setLangState(l);
  const [notificationsOpen,setNotifs] = useState(false);
  const [paletteOpen,setPalette]      = useState(false);
  const [createModalOpen,setCreate]   = useState(false);
  const [notifications,setNotifications] = useState(NOTIFICATIONS);
  // Filters initialise from the URL so a filtered view can be shared as a link,
  // which is the whole point of a transparency register.
  const [filters,setFilters]          = useState<Filters>(()=>fromQuery(window.location.search.slice(1)));
  const [mapLayers,setMapLayers]      = useState<MapLayers>({markers:true,boundaries:true,labels:true,cluster:false});
  const [colorBy,setColorBy]          = useState<string|null>(null);   // null = follow the filter


  const handleViewDetail = (id:string) => { setSelId(id); setScreen("project-detail"); };
  const handleLogin   = (role:Role) => { setUserRole(role); setIsLoggedIn(true); setScreen(role==="public"?"transparency":"dashboard"); toast.success(`Welcome back${role==="public"?"":", A. Reyes"}!`); };
  const handleLogout  = () => { setIsLoggedIn(false); toast.info("Signed out."); };
  const handleMarkAllRead = () => setNotifications(ns=>ns.map(n=>({...n,read:true})));
  const handleNavigate= (s:Screen) => { setScreen(s); setNotifs(false); setPalette(false); };

  // Global keyboard shortcuts
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const meta=e.metaKey||e.ctrlKey;
      if(meta&&e.key==="k"){ e.preventDefault(); setPalette(v=>!v); }
      if(e.key==="Escape")  { setPalette(false); setNotifs(false); }
    };
    window.addEventListener("keydown",handler);
    return ()=>window.removeEventListener("keydown",handler);
  },[]);

  const visibleProjects = useMemo(()=>applyFilters(filters),[filters]);
  useEffect(()=>{
    const qs=toQueryString(filters);
    window.history.replaceState(null,"",qs?`?${qs}`:window.location.pathname);
  },[filters]);
  const selectedProject = PROJECTS.find(p=>p.id===selectedProjectId)??PROJECTS[0];
  const unreadCount     = notifications.filter(n=>!n.read).length;
  const canCreate       = ["dpwh-admin","dpwh-engineer"].includes(userRole);
  const showSidebar     = screen==="map";

  if(!isLoggedIn) return (
    <>
      <LoginScreen onLogin={handleLogin}/>
      <Toaster position="bottom-right" richColors/>
    </>
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{fontFamily:"Inter, sans-serif"}}>
      <Toaster position="bottom-right" richColors/>

      {paletteOpen&&(
        <CommandPalette onClose={()=>setPalette(false)} onNavigate={handleNavigate} onCreate={()=>{setCreate(true);setPalette(false);}}/>
      )}

      {createModalOpen&&<CreateProjectModal onClose={()=>setCreate(false)} onSave={()=>{}}/>}

      <div className="relative shrink-0">
        <TopNav screen={screen} onNavigate={handleNavigate} onToggleSidebar={()=>setSidebar(v=>!v)} canToggleSidebar={showSidebar}
          onToggleNotifications={()=>setNotifs(v=>!v)} unreadCount={unreadCount} role={userRole} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang}
          onLogout={handleLogout} onCreateProject={()=>setCreate(true)} canCreate={canCreate}
          onOpenPalette={()=>setPalette(true)}/>
        {notificationsOpen&&(
          <NotificationsPanel onClose={()=>setNotifs(false)} notifications={notifications} onMarkAllRead={handleMarkAllRead}/>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showSidebar&&(
          <FilterPanel filters={filters} setFilters={setFilters} collapsed={sidebarCollapsed} role={userRole} lang={lang} layers={mapLayers} setLayers={setMapLayers} colorBy={colorBy} setColorBy={setColorBy}/>
        )}
        <main className="flex-1 flex overflow-hidden" role="main">
          {screen==="dashboard"    &&<DashboardScreen onNavigate={handleNavigate} onViewDetail={handleViewDetail}/>}
          {screen==="map"          &&<MapScreen projects={visibleProjects} onViewDetail={handleViewDetail} filters={filters} onClearFilters={()=>setFilters(emptyFilters())} role={userRole} layers={mapLayers} colorBy={colorBy}/>}
          {screen==="project-detail"&&<ProjectDetailScreen project={selectedProject} onBack={()=>setScreen("map")} onOpenSatellite={()=>setScreen("satellite")}/>}
          {screen==="satellite"    &&<SatelliteScreen initialId={selectedProjectId} onOpenRecord={handleViewDetail} reviewerLabel={ROLE_CFG[userRole].label}/>}
          {screen==="documents"    &&<DocumentsScreen/>}
          {screen==="citizen-report"&&<ReportsFeed onOpenProject={handleViewDetail} role={ROLE_LABELS_PUBLIC[userRole]}/>}
          {screen==="contractors"  &&<ContractorsScreen/>}
          {screen==="admin"        &&<AdminScreen/>}
          {screen==="nationwide"   &&<NationwideScreen/>}
          {screen==="transparency" &&<TransparencyScreen onLogin={()=>setIsLoggedIn(false)}/>}
        </main>
      </div>
    </div>
  );
}
