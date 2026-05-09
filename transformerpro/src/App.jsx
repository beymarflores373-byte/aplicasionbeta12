import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileText, Zap, Box, Activity, Shield, Printer, 
  Plus, Trash2, Moon, Sun, AlertTriangle, CheckCircle, ChevronRight, BarChart3, Info, User
} from 'lucide-react';

const STANDARD_KVA = [15, 25, 37.5, 50, 75, 100, 150, 167, 250, 333, 500, 750, 1000, 1500, 2000, 2500];
const SOIL_TYPES = [
  { name: 'Tierra húmeda / Pantanosa', rho: 30 },
  { name: 'Arcilla / Tierra de cultivo', rho: 50 },
  { name: 'Arena húmeda', rho: 200 },
  { name: 'Arena seca', rho: 1000 },
  { name: 'Grava / Suelo pedregoso', rho: 3000 },
  { name: 'Roca', rho: 10000 },
];

const FormInput = ({ label, type = "text", value, onChange, placeholder, suffix, step }) => (
  <div className="flex flex-col mb-4">
    <label className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <input type={type} step={step} value={value === null || value === undefined ? '' : value} onChange={onChange} placeholder={placeholder}
        className="w-full px-4 py-2.5 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-gray-100 shadow-sm" />
      {suffix && <span className="absolute right-4 top-2.5 text-gray-400 font-medium">{suffix}</span>}
    </div>
  </div>
);

const FormSelect = ({ label, value, onChange, options }) => (
  <div className="flex flex-col mb-4">
    <label className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <select value={value} onChange={onChange}
      className="w-full px-4 py-2.5 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-gray-100 shadow-sm appearance-none">
      {options.map((opt, i) => (
        <option key={i} value={opt.hasOwnProperty('value') ? opt.value : opt}>{opt.label || opt}</option>
      ))}
    </select>
  </div>
);

const SectionCard = ({ children, title, icon: Icon, className = "" }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 mb-6 ${className}`}>
    {title && (
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-50 dark:border-gray-800">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">{Icon && <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}</div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
    )}
    {children}
  </div>
);

export default function TransformerPro() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('proyecto');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [project, setProject] = useState({
    name: '', owner: '', type: 'Industrial', location: '',
    voltageAT: 24.9, voltageBT: 380, phase: 'Trifásico', freq: 50, norm: 'NB 777 (Bolivia)'
  });
  const [loads, setLoads] = useState([]);
  const [newLoad, setNewLoad] = useState({
    category: 'Iluminación', name: '', qty: 1, power: 0, unit: 'kW', demandFactor: 0.8, powerFactor: 0.9
  });
  const [settings, setSettings] = useState({
    reserveFactor: 20, soilRho: 50, rodLength: 2.4, rodDiameterInches: 0.625, normTierra: 'NB 777 (R < 10Ω)'
  });

  const calculations = useMemo(() => {
    let totalKw = 0, maxDemandKw = 0, maxDemandKvar = 0;
    loads.forEach(load => {
      let pKw = Number(load.power) || 0;
      if (load.unit === 'W') pKw /= 1000;
      if (load.unit === 'HP') pKw *= 0.746;
      const qty = Number(load.qty) || 0, df = Number(load.demandFactor) || 0, pf = Number(load.powerFactor) || 1;
      const activeP = pKw * qty, demandP = activeP * df;
      const angle = Math.acos(Math.min(Math.max(pf, 0.1), 1));
      totalKw += activeP; maxDemandKw += demandP; maxDemandKvar += demandP * Math.tan(angle);
    });
    const totalKva = Math.sqrt(Math.pow(maxDemandKw, 2) + Math.pow(maxDemandKvar, 2));
    const globalPf = totalKva > 0 ? maxDemandKw / totalKva : 0;
    const requiredKva = totalKva * (1 + (Number(settings.reserveFactor) || 0) / 100);
    const selectedKva = STANDARD_KVA.find(k => k >= requiredKva) || STANDARD_KVA[STANDARD_KVA.length - 1];
    const root3 = project.phase === 'Trifásico' ? Math.sqrt(3) : 1;
    const vAT = (Number(project.voltageAT) || 1) * 1000, vBT = Number(project.voltageBT) || 1;
    const currentAT = (selectedKva * 1000) / (root3 * vAT);
    const currentBT = (selectedKva * 1000) / (root3 * vBT);
    const impedanceZ = selectedKva <= 630 ? 4.0 : 6.0;
    const iccBT = currentBT / (impedanceZ / 100);
    let trafoType = 'Distribución en aceite (ONAN)';
    if (['Hospitalario', 'Comercial'].includes(project.type)) trafoType = 'Seco encapsulado (Resina Epoxi)';
    const L = Number(settings.rodLength) || 2.4, diamInches = Number(settings.rodDiameterInches) || 0.625;
    const d = diamInches * 0.0254, rho = Number(settings.soilRho) || 50;
    const rTierra = (rho / (2 * Math.PI * L)) * (Math.log((4 * L) / d) - 1);
    return { totalKw, maxDemandKw, maxDemandKvar, totalKva, globalPf, requiredKva, selectedKva, currentAT, currentBT, impedanceZ, iccBT, rTierra, trafoType, L, d, rho };
  }, [loads, settings, project]);

  const handleAddLoad = () => {
    if (!newLoad.name || Number(newLoad.power) <= 0) return;
    setLoads([...loads, { ...newLoad, id: Date.now() }]);
    setNewLoad({ ...newLoad, name: '', power: 0, category: 'Iluminación', qty: 1, unit: 'kW', demandFactor: 0.8, powerFactor: 0.9 });
  };

  const handleNumericChange = useCallback((setter, field) => (e) => {
    const val = e.target.value;
    setter(prev => ({ ...prev, [field]: val === '' ? '' : parseFloat(val) }));
  }, []);

  const handlePrint = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => loadJsPDF(), 500);
  };

  const loadJsPDF = () => {
    if (window.jspdf) { generatePDF(); return; }
    const s1 = document.createElement('script');
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s1.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s2.onload = () => generatePDF();
      s2.onerror = () => generatePDF();
      document.body.appendChild(s2);
    };
    s1.onerror = () => { alert('Sin conexión para cargar el generador PDF.'); setIsGeneratingPdf(false); };
    document.body.appendChild(s1);
  };

  const generatePDF = () => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const W = 215.9, margin = 15;
      let y = 20;

      const addHeader = () => {
        doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('TransformerPro', margin, 11);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.text('MEMORIA TECNICA DE DISENO ELECTRICO', margin, 16);
        doc.setFontSize(8);
        doc.text(project.name || 'Proyecto Sin Nombre', W - margin, 10, { align: 'right' });
        doc.text('Fecha: ' + new Date().toLocaleDateString(), W - margin, 16, { align: 'right' });
        doc.setTextColor(0, 0, 0); y = 28;
      };

      const checkPage = (needed = 20) => { if (y + needed > 260) { doc.addPage(); addHeader(); } };

      const sectionTitle = (title) => {
        checkPage(15);
        doc.setFillColor(239, 246, 255); doc.rect(margin, y, W - margin * 2, 10, 'F');
        doc.setFillColor(37, 99, 235); doc.rect(margin, y, 3, 10, 'F');
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
        doc.text(title, margin + 6, y + 7); doc.setTextColor(0, 0, 0); y += 14;
      };

      const field = (label, value) => {
        checkPage(8);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
        doc.text(label + ':', margin, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        doc.text(String(value), margin + 75, y); y += 7;
      };

      // SECCIÓN 1
      addHeader();
      sectionTitle('1. DATOS GENERALES DEL PROYECTO');
      field('Nombre del Proyecto', project.name || 'Sin nombre');
      field('Propietario / Cliente', project.owner || 'Sin especificar');
      field('Tipo de Instalacion', project.type);
      field('Ubicacion', project.location || 'Sin especificar');
      field('Norma de Referencia', project.norm);
      field('Tension Media Tension', project.voltageAT + ' kV');
      field('Tension Baja Tension', project.voltageBT + ' V');
      field('Sistema', project.phase);
      field('Frecuencia', project.freq + ' Hz');
      y += 5;

      // SECCIÓN 2
      sectionTitle('2. PLANILLA DE CARGAS');
      if (loads.length === 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
        doc.text('No hay cargas registradas.', margin, y); y += 8; doc.setTextColor(0, 0, 0);
      } else {
        const tableData = loads.map(load => {
          let pKw = Number(load.power) || 0;
          if (load.unit === 'W') pKw /= 1000;
          if (load.unit === 'HP') pKw *= 0.746;
          const dem = pKw * (Number(load.qty) || 0) * (Number(load.demandFactor) || 0);
          return [load.name, load.category, load.qty, `${load.power} ${load.unit}`, load.demandFactor, load.powerFactor, dem.toFixed(2) + ' kW'];
        });
        doc.autoTable({ startY: y, head: [['Descripcion', 'Categoria', 'Cant.', 'Potencia U.', 'F.D.', 'F.P.', 'Demanda (kW)']], body: tableData,
          margin: { left: margin, right: margin }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [239, 246, 255] }, theme: 'grid' });
        y = doc.lastAutoTable.finalY + 8;
      }

      checkPage(60);
      sectionTitle('2.1 RESUMEN DE POTENCIAS DEL SISTEMA');
      doc.autoTable({ startY: y, head: [['Parametro', 'Valor']],
        body: [
          ['Potencia Instalada (Pi)', calculations.totalKw.toFixed(2) + ' kW (Activa)'],
          ['Demanda Maxima Activa (Pdm)', calculations.maxDemandKw.toFixed(2) + ' kW'],
          ['Demanda Maxima Reactiva (Qdm)', calculations.maxDemandKvar.toFixed(2) + ' kVAR'],
          ['Potencia Aparente Total (S)', calculations.totalKva.toFixed(2) + ' kVA'],
          ['Factor de Potencia Global', calculations.globalPf.toFixed(3)],
        ],
        margin: { left: margin, right: margin }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 }, columnStyles: { 1: { fontStyle: 'bold', textColor: [37, 99, 235] } }, theme: 'grid' });
      y = doc.lastAutoTable.finalY + 8;

      // SECCIÓN 3
      doc.addPage(); addHeader();
      sectionTitle('3. DIMENSIONAMIENTO DEL TRANSFORMADOR');
      doc.autoTable({ startY: y, head: [['Parametro', 'Valor']],
        body: [
          ['Potencia Requerida con Reserva', calculations.requiredKva.toFixed(2) + ' kVA'],
          ['Factor de Reserva Aplicado', settings.reserveFactor + ' %'],
          ['Transformador Seleccionado', calculations.selectedKva + ' kVA'],
          ['Tipo de Transformador', calculations.trafoType],
          ['Corriente Nominal AT', calculations.currentAT.toFixed(2) + ' A'],
          ['Corriente Nominal BT', calculations.currentBT.toFixed(2) + ' A'],
          ['Impedancia Z%', calculations.impedanceZ + ' %'],
          ['Corriente de Cortocircuito BT (Icc)', (calculations.iccBT / 1000).toFixed(2) + ' kA'],
        ],
        margin: { left: margin, right: margin }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 }, columnStyles: { 1: { fontStyle: 'bold' } }, theme: 'grid' });
      y = doc.lastAutoTable.finalY + 8;

      // SECCIÓN 4
      sectionTitle('4. SISTEMA DE PUESTA A TIERRA');
      doc.autoTable({ startY: y, head: [['Parametro', 'Valor']],
        body: [
          ['Normativa Aplicada', settings.normTierra],
          ['Resistividad del Suelo', calculations.rho + ' Ohm.m'],
          ['Longitud de Jabalina', calculations.L + ' m'],
          ['Diametro de Jabalina', settings.rodDiameterInches + '" (' + (calculations.d * 1000).toFixed(1) + ' mm)'],
          ['Resistencia Calculada', calculations.rTierra.toFixed(2) + ' Ohm'],
          ['Estado Normativo', calculations.rTierra <= 10 ? 'CUMPLE (R <= 10 Ohm)' : 'NO CUMPLE - Requiere tratamiento'],
        ],
        margin: { left: margin, right: margin }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 }, columnStyles: { 1: { fontStyle: 'bold', textColor: calculations.rTierra <= 10 ? [5, 150, 105] : [220, 38, 38] } }, theme: 'grid' });
      y = doc.lastAutoTable.finalY + 8;

      // SECCIÓN 5
      doc.addPage(); addHeader();
      sectionTitle('5. CRITERIOS DE PROTECCION AT/BT');
      doc.autoTable({ startY: y, head: [['Parametro', 'Valor']],
        body: [
          ['MEDIA TENSION (AT)', ''],
          ['Corriente Nominal AT', calculations.currentAT.toFixed(2) + ' A'],
          ['Fusibles tipo Expulsion (In x 1.5)', (calculations.currentAT * 1.5).toFixed(1) + ' A'],
          ['Descargadores / Pararrayos', (Number(project.voltageAT) * 1.2).toFixed(1) + ' kV'],
          ['TABLERO GENERAL BT (TGBT)', ''],
          ['Corriente Nominal BT', calculations.currentBT.toFixed(2) + ' A'],
          ['Interruptor General (125%)', (calculations.currentBT * 1.25).toFixed(0) + ' A'],
          ['Nivel de Cortocircuito (Icc)', (calculations.iccBT / 1000).toFixed(2) + ' kA'],
          ['Capacidad de Ruptura minima', '> ' + Math.ceil(calculations.iccBT / 1000) + ' kA'],
        ],
        margin: { left: margin, right: margin }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 }, columnStyles: { 1: { fontStyle: 'bold' } }, theme: 'grid' });
      y = doc.lastAutoTable.finalY + 25;

      // FIRMAS
      checkPage(40);
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, y + 20, margin + 70, y + 20);
      doc.line(W - margin - 70, y + 20, W - margin, y + 20);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      doc.text('Firma del Profesional Responsable', margin + 35, y + 25, { align: 'center' });
      doc.text('Aprobacion Tecnica / Entidad', W - margin - 35, y + 25, { align: 'center' });
      y += 40;
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text('Memoria generada por: Esp. Froilan Cori C. & Univ. Beymar Flores S. - ' + new Date().toLocaleDateString(), W / 2, y, { align: 'center' });

      // NUMERACIÓN
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text('Pagina ' + i + ' de ' + pageCount, W - margin, 287, { align: 'right' });
      }

      doc.save('Memoria_Tecnica_' + (project.name || 'Proyecto') + '.pdf');
      setIsGeneratingPdf(false);
    } catch (err) {
      console.error('Error PDF:', err);
      alert('Error al generar PDF: ' + err.message);
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-950' : 'bg-slate-50'} text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300`}>
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/30"><Zap className="w-6 h-6 text-white" /></div>
          <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Transformer<span className="text-blue-600">Pro</span></h1>
        </div>
        <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-500" />}
        </button>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8 p-6">
        <nav className="w-full md:w-64 space-y-1">
          {[
            { id: 'proyecto', icon: FileText, label: 'Datos Proyecto' },
            { id: 'cargas', icon: Zap, label: 'Planilla de Cargas' },
            { id: 'trafo', icon: Box, label: 'Transformador' },
            { id: 'tierra', icon: Activity, label: 'Puesta a Tierra' },
            { id: 'protecciones', icon: Shield, label: 'Protecciones' },
            { id: 'info', icon: Info, label: 'Información de Aplicación' },
            { id: 'reporte', icon: Printer, label: 'Generar Reporte' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-bold' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}>
              <div className="flex items-center gap-3"><tab.icon className="w-5 h-5" /><span>{tab.label}</span></div>
              {activeTab === tab.id && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </nav>

        <main className="flex-1">
          {activeTab === 'proyecto' && (
            <SectionCard title="Datos Generales del Proyecto" icon={FileText}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <FormInput label="Nombre del Proyecto" value={project.name} onChange={e => setProject({...project, name: e.target.value})} placeholder="Ej. Urbanización Los Olivos" />
                <FormInput label="Propietario / Cliente" value={project.owner} onChange={e => setProject({...project, owner: e.target.value})} />
                <FormSelect label="Tipo de Instalación" value={project.type} onChange={e => setProject({...project, type: e.target.value})} options={['Residencial', 'Comercial', 'Industrial', 'Hospitalario', 'Otro']} />
                <FormInput label="Ubicación" value={project.location} onChange={e => setProject({...project, location: e.target.value})} />
                <FormSelect label="Norma de Referencia" value={project.norm} onChange={e => setProject({...project, norm: e.target.value})} options={['NB 777 (Bolivia)', 'IEC 60364', 'NEC / NFPA 70']} />
                <div className="grid grid-cols-2 gap-4">
                  <FormSelect label="Media Tensión (kV)" value={project.voltageAT} onChange={e => setProject({...project, voltageAT: parseFloat(e.target.value)})} options={[{label:'10 kV', value:10},{label:'13.2 kV', value:13.2},{label:'24.9 kV', value:24.9},{label:'34.5 kV', value:34.5}]} />
                  <FormSelect label="Baja Tensión (V)" value={project.voltageBT} onChange={e => setProject({...project, voltageBT: parseFloat(e.target.value)})} options={[{label:'220 V', value:220},{label:'380 V', value:380},{label:'440 V', value:440}]} />
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'cargas' && (
            <SectionCard title="Planilla de Carga y Resumen de Potencias" icon={Zap}>
              <div className="bg-slate-50 dark:bg-gray-800/50 p-6 rounded-3xl mb-8 border border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-black mb-4 text-gray-400 uppercase tracking-widest">Añadir Nueva Carga</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormSelect label="Categoría" value={newLoad.category} onChange={e => setNewLoad({...newLoad, category: e.target.value})} options={['Iluminación', 'Tomacorrientes', 'Fuerza Motriz', 'Climatización', 'Especiales']} />
                  <FormInput label="Descripción" value={newLoad.name} onChange={e => setNewLoad({...newLoad, name: e.target.value})} />
                  <FormInput label="Cantidad" type="number" value={newLoad.qty} onChange={handleNumericChange(setNewLoad, 'qty')} />
                  <div className="flex gap-2">
                    <FormInput label="Potencia" type="number" value={newLoad.power} onChange={handleNumericChange(setNewLoad, 'power')} />
                    <FormSelect label="Und." value={newLoad.unit} onChange={e => setNewLoad({...newLoad, unit: e.target.value})} options={['kW', 'W', 'HP']} />
                  </div>
                  <FormInput label="F. Demanda" type="number" step="0.1" value={newLoad.demandFactor} onChange={handleNumericChange(setNewLoad, 'demandFactor')} />
                  <FormInput label="F. Potencia" type="number" step="0.1" value={newLoad.powerFactor} onChange={handleNumericChange(setNewLoad, 'powerFactor')} />
                  <div className="col-span-2 flex items-end mb-4">
                    <button onClick={handleAddLoad} className="w-full h-[46px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                      <Plus className="w-5 h-5" /> Añadir Carga
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-2xl mb-8">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] uppercase font-black text-gray-500 tracking-widest border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-4">Descripción</th><th className="px-4 py-4 text-center w-20">Cant.</th>
                      <th className="px-4 py-4 text-right">Potencia U.</th><th className="px-4 py-4 text-center">F.D.</th>
                      <th className="px-4 py-4 text-center">F.P.</th><th className="px-4 py-4 text-right text-blue-600">Demanda (kW)</th>
                      <th className="px-4 py-4 text-center">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {loads.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-6 text-gray-500 italic">No hay cargas registradas.</td></tr>
                    ) : loads.map(load => {
                      let pKw = Number(load.power) || 0;
                      if (load.unit === 'W') pKw /= 1000;
                      if (load.unit === 'HP') pKw *= 0.746;
                      const dem = pKw * (Number(load.qty) || 0) * (Number(load.demandFactor) || 0);
                      return (
                        <tr key={load.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-4 font-bold">{load.name}<span className="block text-xs font-normal text-gray-500">{load.category}</span></td>
                          <td className="px-4 py-4 text-center">{load.qty}</td>
                          <td className="px-4 py-4 text-right">{load.power} {load.unit}</td>
                          <td className="px-4 py-4 text-center">{load.demandFactor}</td>
                          <td className="px-4 py-4 text-center">{load.powerFactor}</td>
                          <td className="px-4 py-4 text-right font-black text-blue-600">{dem.toFixed(2)} kW</td>
                          <td className="px-4 py-4 text-center">
                            <button onClick={() => setLoads(loads.filter(l => l.id !== load.id))} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 dark:bg-gray-800/80 rounded-3xl p-6 border-2 border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2 mb-6"><BarChart3 className="w-5 h-5 text-blue-600" /><h3 className="text-lg font-black uppercase tracking-tight">Cuadro: Resumen de Potencias del Sistema</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Potencia Instalada (Pi)</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{calculations.totalKw.toFixed(2)} <span className="text-sm font-bold">kW (Activa)</span></p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Demanda Máxima (Pdm)</p>
                    <p className="text-2xl font-black text-blue-600">{calculations.maxDemandKw.toFixed(2)} <span className="text-sm font-bold">kW (Activa)</span></p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Demanda Máxima (Qdm)</p>
                    <p className="text-2xl font-black text-indigo-500">{calculations.maxDemandKvar.toFixed(2)} <span className="text-sm font-bold">kVAR (Reactiva)</span></p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl shadow-lg lg:col-span-2">
                    <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Potencia Aparente Total (S)</p>
                    <p className="text-3xl font-black text-white">{calculations.totalKva.toFixed(2)} kVA</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-sm flex flex-col justify-center text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Factor de Potencia Global</p>
                    <p className="text-3xl font-black text-emerald-600">{calculations.globalPf.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'trafo' && (
            <SectionCard title="Dimensionamiento del Transformador" icon={Box}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-blue-600 mb-4 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Parámetros Técnicos</h3>
                  <FormInput label="Factor de Reserva (%)" type="number" value={settings.reserveFactor} onChange={handleNumericChange(setSettings, 'reserveFactor')} suffix="%" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Corriente Nom. AT</p>
                      <p className="text-xl font-black">{calculations.currentAT.toFixed(2)} A</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Corriente Nom. BT</p>
                      <p className="text-xl font-black">{calculations.currentBT.toFixed(2)} A</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-500 uppercase">Impedancia Z% / Icc kA</span>
                    <span className="font-black">{calculations.impedanceZ}% / {(calculations.iccBT / 1000).toFixed(2)} kA</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Transformador Seleccionado</p>
                  <p className="text-sm font-bold bg-white/20 px-3 py-1 rounded-lg inline-block mb-4 border border-white/20">{calculations.trafoType}</p>
                  <h2 className="text-7xl font-black mb-2">{calculations.selectedKva} <span className="text-3xl">kVA</span></h2>
                  <p className="text-sm font-medium opacity-90">Potencia Normalizada Estandarizada</p>
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'tierra' && (
            <SectionCard title="Sistema de Puesta a Tierra" icon={Activity}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-blue-600 mb-4 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Parámetros del Electrodo y Suelo</h3>
                  <FormSelect label="Normativa Aplicada" value={settings.normTierra} onChange={e => setSettings({...settings, normTierra: e.target.value})} options={['NB 777 (R < 10Ω)', 'IEEE 80', 'IEC 60364']} />
                  <FormSelect label="Tipo de Suelo (Referencia)" value={settings.soilRho} onChange={e => setSettings({...settings, soilRho: parseFloat(e.target.value)})} options={SOIL_TYPES.map(s => ({ label: `${s.name} (≈ ${s.rho} Ω·m)`, value: s.rho }))} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="Resistividad Exacta (Ω·m)" type="number" value={settings.soilRho} onChange={handleNumericChange(setSettings, 'soilRho')} />
                    <FormInput label="Long. Jabalina (m)" type="number" value={settings.rodLength} onChange={handleNumericChange(setSettings, 'rodLength')} />
                  </div>
                  <FormSelect label="Diámetro Jabalina (Pulgadas)" value={settings.rodDiameterInches} onChange={e => setSettings({...settings, rodDiameterInches: parseFloat(e.target.value)})}
                    options={[{label:'1/2" (Media pulgada)', value:0.5},{label:'5/8" (Cinco octavos)', value:0.625},{label:'3/4" (Tres cuartos)', value:0.75},{label:'1" (Una pulgada)', value:1.0}]} />
                </div>
                <div className="flex flex-col justify-center items-center">
                  <div className={`p-10 rounded-full border-8 text-center transition-all ${calculations.rTierra <= 10 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'}`}>
                    <p className="text-xs font-black uppercase text-gray-400 mb-1">Resistencia Calculada</p>
                    <h2 className="text-6xl font-black">{calculations.rTierra.toFixed(2)} Ω</h2>
                  </div>
                  <div className={`mt-6 px-6 py-2 rounded-2xl font-black text-sm flex items-center gap-2 ${calculations.rTierra <= 10 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    {calculations.rTierra <= 10 ? <CheckCircle className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
                    {calculations.rTierra <= 10 ? 'CUMPLE NORMA' : 'NO CUMPLE'}
                  </div>
                  <div className="w-full bg-gray-50 dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 text-sm mt-8 text-left">
                    <p className="font-black uppercase tracking-widest text-xs text-gray-500 mb-3">Criterio Normativo (NB 777 / IEC 60364):</p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300 font-medium">
                      <li><strong>R ≤ 10 Ω</strong>: Instalaciones generales en Baja Tensión.</li>
                      <li><strong>R ≤ 5 Ω</strong>: Instalaciones especiales, Hospitales o Data Centers.</li>
                      <li><strong>R ≤ 1 Ω</strong>: Subestaciones de potencia.</li>
                    </ul>
                    {calculations.rTierra > 10 && (
                      <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
                        <p className="text-red-700 dark:text-red-400 font-bold text-xs">* Nota: Se requiere tratamiento químico del suelo (Bentonita, Thor-Gel) o configuración en malla/múltiples jabalinas.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'protecciones' && (
            <SectionCard title="Criterios de Protección AT/BT" icon={Shield}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border-2 border-red-100 dark:border-red-900/30 rounded-3xl overflow-hidden">
                  <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><Zap className="w-5 h-5 text-red-600"/></div>
                    <h3 className="font-black text-sm uppercase tracking-widest text-red-800 dark:text-red-400">Media / Alta Tensión (AT)</h3>
                  </div>
                  <div className="p-6 space-y-6 bg-white dark:bg-gray-900">
                    <div><p className="text-xs font-bold text-gray-400 uppercase mb-1">Corriente Nominal AT</p><p className="font-black text-2xl">{calculations.currentAT.toFixed(2)} A</p></div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Fusibles tipo Expulsión (In * 1.5)</p>
                      <p className="font-black text-2xl text-red-600 dark:text-red-400">{(calculations.currentAT * 1.5).toFixed(1)} A</p>
                      <p className="text-[10px] text-gray-500 mt-1">Normalizar al valor comercial superior inmediato.</p>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Descargadores / Pararrayos</p>
                      <p className="font-black text-2xl">{(Number(project.voltageAT) * 1.2).toFixed(1)} kV</p>
                    </div>
                  </div>
                </div>
                <div className="border-2 border-blue-100 dark:border-blue-900/30 rounded-3xl overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-4 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Shield className="w-5 h-5 text-blue-600"/></div>
                    <h3 className="font-black text-sm uppercase tracking-widest text-blue-800 dark:text-blue-400">Tablero General Baja Tensión (TGBT)</h3>
                  </div>
                  <div className="p-6 space-y-6 bg-white dark:bg-gray-900">
                    <div><p className="text-xs font-bold text-gray-400 uppercase mb-1">Corriente Nominal BT</p><p className="font-black text-2xl">{calculations.currentBT.toFixed(2)} A</p></div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Interruptor General (Breaker Principal)</p>
                      <p className="font-black text-3xl text-blue-600 dark:text-blue-400">{(calculations.currentBT * 1.25).toFixed(0)} A</p>
                      <p className="text-[10px] text-gray-500 mt-1">Capacidad ajustada al 125% (Norma térmica).</p>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Nivel de Cortocircuito en Bornes (Icc)</p>
                      <p className="font-black text-2xl">{(calculations.iccBT / 1000).toFixed(2)} kA</p>
                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Capacidad de Ruptura (Pdc) mínima recomendada:<br/><strong>&gt; {Math.ceil(calculations.iccBT / 1000)} kA</strong></span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'info' && (
            <SectionCard title="Información de Aplicación" icon={Info}>
              <div className="flex flex-col items-center justify-center py-10">
                <div className="bg-blue-600 p-6 rounded-3xl shadow-2xl mb-8"><Zap className="w-16 h-16 text-white" /></div>
                <h2 className="text-3xl font-black mb-2">Transformer<span className="text-blue-600">Pro</span></h2>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-10">Software de Cálculo y Dimensionamiento</p>
                <div className="w-full max-w-md bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-4"><User className="w-5 h-5 text-blue-600" /><h3 className="font-black text-sm uppercase tracking-wider">Desarrolladores del Programa</h3></div>
                  <ul className="space-y-4">
                    <li className="flex flex-col"><span className="text-lg font-bold text-gray-900 dark:text-gray-100">Esp. Sup. Téc. Froilán Cori C.</span><span className="text-xs font-bold text-blue-500 uppercase">Sistemas Eléctricos</span></li>
                    <div className="h-px bg-gray-100 dark:bg-gray-700 w-full"></div>
                    <li className="flex flex-col"><span className="text-lg font-bold text-gray-900 dark:text-gray-100">Univ. Beymar Flores S.</span><span className="text-xs font-bold text-blue-500 uppercase">Cálculo y Desarrollo Algorítmico</span></li>
                  </ul>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-10">Versión 2.3.0 • La Paz - Bolivia</p>
              </div>
            </SectionCard>
          )}

          {activeTab === 'reporte' && (
            <SectionCard title="Generar Reporte" icon={Printer}>
              <div className="flex flex-col items-center gap-4 py-8">
                <Printer className="w-12 h-12 text-blue-600 mb-2" />
                <div className="text-center">
                  <h3 className="text-2xl font-black">Reporte Final de Ingeniería</h3>
                  <p className="text-gray-500 text-sm mt-2">Genera la memoria técnica completa en formato PDF tamaño Carta.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 w-full max-w-sm border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300 font-medium">
                  <p className="font-black mb-1">El PDF incluye:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Datos generales del proyecto</li>
                    <li>Planilla de cargas completa</li>
                    <li>Resumen de potencias</li>
                    <li>Dimensionamiento del transformador</li>
                    <li>Sistema de puesta a tierra</li>
                    <li>Criterios de protección AT/BT</li>
                    <li>Área de firmas y aprobación</li>
                  </ul>
                </div>
                <button onClick={handlePrint} disabled={isGeneratingPdf}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/30 transition-all mt-4 flex items-center justify-center gap-2 w-full max-w-sm">
                  {isGeneratingPdf ? 'GENERANDO PDF...' : 'DESCARGAR MEMORIA TÉCNICA PDF'}
                </button>
              </div>
            </SectionCard>
          )}
        </main>
      </div>
    </div>
  );
}
