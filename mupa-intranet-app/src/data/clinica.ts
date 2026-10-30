/*
 * Clínica Municipal: especialidades y servicios del sitio actual. En esta copia los nombres
 * del personal son inventados y no hay fotos (se muestran sus iniciales).
 */
/** `foto` vacía: se muestran las iniciales. */
export type Persona = { espec: string; nombre: string; foto: string; servicios: string[] }

export const PERSONAL: Persona[] = [
  {
    espec: 'Medicina General',
    nombre: 'Dra. Ana Ejemplo',
    foto: '',
    servicios: [
      'Enfermedades agudas y crónicas',
      'Evaluación pre-ingreso de Policías Municipales',
      'Triage respiratorio Covid-19 y post-Covid',
      'Consultas y recetas de pacientes crónicos',
      'Evaluación a personas sin techo',
      'Cirugías menores',
      'Programa de control de DM y HTA',
      'Charlas y giras de salud integral',
    ],
  },
  {
    espec: 'Fonoaudiología',
    nombre: 'Licda. Lucía Prueba',
    foto: '',
    servicios: [
      'Audiometrías y programa de conservación auditiva',
      'Evaluaciones y terapias de habla y lenguaje (CEDIS pre-jardín y jardín)',
      'Programa "comunicándome" (disfemia)',
      'Otoscopia',
      'Apoyo a la fundación "Oír es vivir"',
      'Juntas Comunales, Parque Summit, residencial Años Dorados',
    ],
  },
  {
    espec: 'Odontología',
    nombre: 'Dr. Carlos Modelo',
    foto: '',
    servicios: ['Atención integral a colaboradores e hijos hasta 18 años', 'Atención en CEDIS', 'Giras'],
  },
  {
    espec: 'Nutrición y Dietética',
    nombre: 'Lic. Jorge Muestra',
    foto: '',
    servicios: [
      'Obesidad, bajo peso, dislipidemias, hormonales, diabetes, hipertensión, ovarios poliquísticos, estreñimiento',
      'Embarazo y lactancia (lactario)',
      'Enfermedades crónicas',
      'Monitoreo alimentario de los 13 CEDIS',
      'Docencias',
    ],
  },
  {
    espec: 'Psicología Clínica',
    nombre: 'Mgtr. Elena Ficticio',
    foto: '',
    servicios: [
      'Atenciones clínicas a servidores e hijos, evaluaciones, psicoterapia',
      'Certificados de salud mental, terapias de grupo, atención virtual',
      'Referencias a psiquiatría e intervención en crisis',
      'Patologías frecuentes: depresión, ansiedad, abuso de sustancias, violencia de pareja/familia, adaptación, conducta, hábitos e impulsos, duelo',
    ],
  },
  {
    espec: 'Psicología Clínica',
    nombre: 'Mgtr. Pedro Demo',
    foto: '',
    servicios: [
      'Atenciones clínicas a servidores e hijos, evaluaciones, psicoterapia',
      'Certificados de salud mental, terapias de grupo, atención virtual',
      'Referencias a psiquiatría e intervención en crisis',
    ],
  },
  {
    espec: 'Psicología General',
    nombre: 'Lic. Andrés Ensayo',
    foto: '',
    servicios: [
      'Estrés laboral y familiar, depresión, pánico, duelo, conflictos familiares',
      'Certificaciones académicas y laborales',
      'Apoyo a CEDI: maduración, pronóstico de egreso, conducta y aprendizaje, escuela para padres',
      'Abordaje a personas en situación de calle',
    ],
  },
]

/** Medicamentos que dispensa la Clínica, por especialidad. Contenido íntegro de /listado-de-medicamentos/: no agregar ni quitar. */
export const MEDICAMENTOS: { grupo: string; items: string[] }[] = [
  { grupo: 'Cardiología', items: ['Atenolol 100 mg', 'Carvedilol 6.25 mg', 'Diltiazem 180 mg', 'Espironolactona 25 mg', 'Furosemida 40 mg', 'Hidroclorotiazida/Triamtereno 25/50 mg', 'Indapamida 1.5 mg', 'Irbesartán 300 mg', 'Lisinopril 20 mg', 'Metildopa 250 mg', 'Perindopril 5 mg', 'Prazosina 2 mg', 'Propranolol 40 mg'] },
  { grupo: 'Grasas y ácido úrico', items: ['Alopurinol 300 mg', 'Fenofibrato 250 mg', 'Rosuvastatina 10 mg', 'Simvastatina 10 mg'] },
  { grupo: 'Anticonceptivos', items: ['Anovulatorios orales 0.15–0.03 mg', 'Medroxiprogesterona vial 150 mg (1M/C3 meses)', 'Mesigyna/Mesygest ampolla', 'Nomagest ampolla'] },
  { grupo: 'Tiroides', items: ['Levotiroxina 100 mcg', 'Methimazole 5 mg'] },
  { grupo: 'Urología', items: ['Bicalutamida 50 mg', 'Doxazosina 2 mg'] },
  { grupo: 'Digestivo', items: ['Escopolamina butilbromuro 10 mg', 'Hidróxido de aluminio y magnesio susp.', 'Lactulosa 667 mg/ml', 'Omeprazol 20 mg', 'Psyllium polvo', 'Ruibarbo y sodio mixtura', 'Sucralfato 1 g'] },
  { grupo: 'Diabetes Mellitus', items: ['Gliclazida 80 mg', 'Glibenclamida 5 mg', 'Insulina NPH', 'Insulina Regular', 'Insulina glargina (vial o pluma)', 'Lancetas', 'Jeringuillas UI-100', 'Metformina 850 mg', 'Tiras reactivas Accu-Chek'] },
  { grupo: 'Sangre y órganos hematopoyéticos', items: ['AAS 100 mg', 'Ácido fólico 5 mg', 'Cianocobalamina 1000 mcg/ml', 'Clopidogrel 75 mg', 'Fumarato ferroso 200 mg', 'Warfarina 5 mg'] },
  { grupo: 'Vitaminas y minerales', items: ['Vitamina C 500 mg', 'Calcio carbonato 500–1000 mg', 'Complejo B', 'Multivitaminas'] },
  { grupo: 'Dolor', items: ['Acetaminofén 500 mg', 'Diclofenaco 50 mg', 'Ergotamina 1 mg + cafeína 100 mg', 'Gabapentina 300 mg', 'Ibuprofeno 400 mg', 'Mentol compuesto ungüento', 'Tramadol 50 mg', 'Tizanidina 4 mg'] },
  { grupo: 'Alergias y asma', items: ['Beclometasona inhalador', 'Cromoglicato de sodio nasal', 'Furoato de mometasona nasal', 'Loratadina 10 mg', 'Montelukast 10 mg', 'Salbutamol inhalador'] },
  { grupo: 'Epilepsia', items: ['Carbamazepina 200 mg', 'Fenobarbital 64 mg', 'Fenitoína 100 mg'] },
  { grupo: 'Ansiedad, insomnio, depresión', items: ['Amitriptilina', 'Clonazepam 2 mg', 'Diazepam 5 mg', 'Fluoxetina 20 mg', 'Quetiapina 200 mg', 'Zolpidem 10 mg'] },
  { grupo: 'Gotas oftálmicas', items: ['Lágrimas artificiales', 'Timolol 0.5%'] },
]
