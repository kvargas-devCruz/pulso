// Chatbot de normas: respuestas a preguntas frecuentes de pymes y restaurantes en Costa Rica.
// Base de conocimiento escrita a mano y VERIFICADA contra el texto de la norma (consultado el
// 20/11/2026). Nada se genera: la búsqueda es con código y, si el tema no está aquí, se dice.
// Es información general, no asesoría legal.

export interface NormaSource { label: string; url: string }
export interface Norma {
  id: string;
  title: string;
  /** Palabras (normalizadas, sin tildes) que identifican el tema. */
  keywords: string[];
  answer: string;
  sources: NormaSource[];
}

const CODIGO = "https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=8045&param2=&param3=1&param4=";
const SRC_CODIGO = (arts: string): NormaSource => ({ label: `Código de Trabajo, ${arts} (SINALEVI, texto vigente)`, url: CODIGO });

export const NORMAS_DISCLAIMER =
  "Información general según el texto de la norma consultado el 20/11/2026; no es asesoría legal. Confirmalo con tu contador o con el MTSS (800-TRABAJO).";

export const NORMAS: Norma[] = [
  {
    id: "aguinaldo",
    title: "Aguinaldo",
    keywords: ["aguinaldo", "decimotercer", "treceavo", "doceava"],
    answer:
      "Todo patrono privado debe pagar un aguinaldo equivalente a un mes de salario al año (Ley 2412, art. 1). Se calcula con el promedio de los salarios ordinarios y extraordinarios (horas extra incluidas) de los 12 meses anteriores al 1.° de diciembre: en la práctica, se suma lo ganado del 1.° de diciembre al 30 de noviembre y se divide entre 12 (art. 2). Si la persona trabajó menos de un año, pero al menos un mes, recibe la parte proporcional (art. 3). Se paga dentro de los primeros 20 días de diciembre (art. 4). El MTSS tiene una calculadora y recibe denuncias por no pago desde el 21 de diciembre.",
    sources: [
      { label: "Ley 2412, Ley de Aguinaldo para la empresa privada, arts. 1 a 4 (texto publicado en Justia)", url: "https://costa-rica.justia.com/nacionales/leyes/ley-2412/gdoc" },
      { label: "MTSS · Aguinaldo en el sector privado (Campaña 2026)", url: "https://www.mtss.go.cr/temas-laborales/aguinaldo/aguinaldo.html" },
    ],
  },
  {
    id: "vacaciones",
    title: "Vacaciones",
    keywords: ["vacaciones", "vacacion"],
    answer:
      "Cada trabajador tiene derecho a vacaciones pagadas: como mínimo dos semanas por cada cincuenta semanas de trabajo continuo con el mismo patrono. Si el contrato termina antes de las cincuenta semanas, le corresponde como mínimo un día de vacaciones por cada mes trabajado, que se paga al salir. Las incapacidades justificadas y los permisos sin goce de salario no interrumpen esa continuidad.",
    sources: [SRC_CODIGO("art. 153")],
  },
  {
    id: "jornada",
    title: "Jornadas de trabajo",
    keywords: ["jornada", "jornadas", "horas al dia", "horas por semana", "turno", "turnos", "nocturna", "diurna", "mixta", "cuantas horas"],
    answer:
      "La jornada ordinaria no puede pasar de 8 horas de día, 6 de noche y 48 horas por semana. La mixta no pasa de 7 horas, y se considera nocturna si se trabajan 3 horas y media o más entre las 7 p. m. y las 5 a. m. En trabajos que no sean insalubres ni peligrosos se puede pactar una jornada diurna de hasta 10 horas y una mixta de hasta 8, siempre que la semana no pase de 48 horas. Los tiempos de descanso y comida se pactan libremente.",
    sources: [SRC_CODIGO("arts. 136 y 138")],
  },
  {
    id: "horas_extra",
    title: "Horas extra",
    keywords: ["horas extra", "hora extra", "extras", "tiempo extra", "jornada extraordinaria", "tiempo y medio"],
    answer:
      "Lo que se trabaje fuera de la jornada ordinaria (o de la jornada menor que hayan pactado) es jornada extraordinaria y se paga con un 50 % más del salario: tiempo y medio. No cuentan como extra las horas que el trabajador usa para corregir errores que solo son suyos. La jornada ordinaria más la extra no puede pasar de 12 horas al día, salvo emergencias que pongan en peligro a personas o al negocio.",
    sources: [SRC_CODIGO("arts. 139 y 140")],
  },
  {
    id: "feriados",
    title: "Feriados",
    keywords: ["feriado", "feriados", "dia libre", "jueves santo", "viernes santo", "semana santa", "25 de julio", "15 de setiembre", "navidad", "1 de mayo"],
    answer:
      "Feriados de pago obligatorio: 1.° de enero, 11 de abril, Jueves y Viernes Santos, 1.° de mayo, 25 de julio, 15 de agosto, 15 de setiembre y 25 de diciembre. El 2 y el 31 de agosto y el 1.° de diciembre también son feriados, pero su pago no es obligatorio. El 25 de julio se celebra siempre en su fecha (no se traslada). El Código prohíbe poner a trabajar en un feriado; si se hace, hay que pagar como indica el art. 152: el doble del salario de ese día. El feriado se paga con el salario ordinario (o el promedio de la semana, si se paga por pieza).",
    sources: [SRC_CODIGO("arts. 148, 149 y 152")],
  },
  {
    id: "descanso",
    title: "Día libre semanal",
    keywords: ["descanso", "dia de descanso", "libre semanal", "seis dias", "6 dias", "dia libre a la semana"],
    answer:
      "Cada trabajador tiene derecho a un día de descanso absoluto después de cada semana o de cada seis días de trabajo continuo. En los establecimientos comerciales ese día se paga. Si el patrono no lo da, además de la sanción debe pagar el doble del salario de esa jornada.",
    sources: [SRC_CODIGO("art. 152")],
  },
  {
    id: "preaviso",
    title: "Preaviso",
    keywords: ["preaviso", "aviso previo", "renuncia", "renunciar", "avisar con anticipacion"],
    answer:
      "En un contrato por tiempo indefinido, quien termina la relación sin justa causa (patrono o trabajador) debe avisar por escrito con anticipación: al menos una semana si la persona lleva de 3 a 6 meses; 15 días si lleva más de 6 meses y hasta un año; y un mes si lleva más de un año. El aviso se puede omitir pagando el salario de ese plazo. Durante el preaviso, el patrono debe dar un día libre por semana para que la persona busque trabajo.",
    sources: [SRC_CODIGO("art. 28")],
  },
  {
    id: "cesantia",
    title: "Cesantía",
    keywords: ["cesantia", "despido", "despedir", "despidieron", "liquidacion", "indemnizacion", "prestaciones"],
    answer:
      "Si un contrato por tiempo indefinido termina por despido injustificado (u otra causa ajena al trabajador), el patrono paga cesantía: 7 días de salario si la persona trabajó de 3 a 6 meses; 14 días si fueron más de 6 meses y menos de un año; y, de un año en adelante, según la tabla del Código: 19,5 días por año el primer año; 20 el segundo; 20,5 el tercero; 21 el cuarto; 21,24 el quinto; 21,5 el sexto; 22 del séptimo al noveno; 21,5 el décimo; 21 el undécimo; 20,5 el duodécimo; y 20 del decimotercero en adelante. Nunca se pagan más de los últimos 8 años, y se paga aunque la persona empiece de inmediato con otro patrono.",
    sources: [SRC_CODIGO("art. 29, reformado por la Ley 7983 de 2000")],
  },
  {
    id: "servicio",
    title: "El 10 % de servicio",
    keywords: ["10%", "10 %", "diez por ciento", "propina", "propinas", "servicio a la mesa", "saloneros", "meseros"],
    answer:
      "En restaurantes, bares y negocios parecidos, quienes atienden las mesas tienen derecho al 10 % de servicio sobre el consumo (Ley 4946). El patrono no puede quedarse con ese dinero ni impedir que se cobre; lo que el trabajador deje de recibir por culpa del patrono se considera una deuda con él, y al patrono se le aplican las mismas sanciones que el Código de Trabajo prevé para el salario (art. 4). La Ley 9116 de 2012 reformó esta ley: antes de decidir cómo calcularlo o repartirlo, confirmá el texto vigente con tu contador.",
    sources: [
      { label: "Ley 4946 (propinas), art. 4 · reformada por la Ley 9116 de 2012 (texto publicado en Justia)", url: "https://costa-rica.justia.com/nacionales/leyes/ley-4946/gdoc" },
    ],
  },
  {
    id: "iva",
    title: "IVA",
    keywords: ["iva", "impuesto al valor agregado", "13%", "13 %", "trece por ciento", "impuesto de ventas"],
    answer:
      "La tarifa general del IVA es 13 % (Ley 9635, art. 10). La ley tiene tarifas reducidas para algunos bienes y servicios (por ejemplo, la canasta básica). En un restaurante, el consumo paga el 13 % de IVA y, si hay servicio a la mesa, aparte va el 10 % de servicio. Para el detalle de tu caso (tarifas reducidas, créditos fiscales, plazos de declaración en TRIBU-CR), consultá con tu contador.",
    sources: [{ label: "Ley 9635, Ley de Fortalecimiento de las Finanzas Públicas, art. 10 (copia publicada por la UNED)", url: "https://www.uned.ac.cr/ejecutiva/images/direccion-financiera/leyes_decretos/ley_9635.pdf" }],
  },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();

/** Busca el tema que mejor coincide con la pregunta (con código). null si no hay ninguno. */
export function findNorma(question: string): Norma | null {
  const q = ` ${norm(question)} `;
  let best: { n: Norma; score: number } | null = null;
  for (const n of NORMAS) {
    let score = 0;
    for (const k of n.keywords) {
      const kk = norm(k);
      if (/[%]/.test(kk) ? q.includes(kk) : new RegExp(`\\b${kk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q)) score += kk.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { n, score };
  }
  return best?.n ?? null;
}
