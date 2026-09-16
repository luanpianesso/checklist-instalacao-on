// Estrutura do checklist de instalação (replica o PDF "Checklist - Instalação")
// Cada seção contém campos com um "key" único usado em data[key].

export const RADIO_SIM_NAO = [
  { value: 'SIM', label: 'SIM' },
  { value: 'NAO', label: 'NÃO' }
];

export const RADIO_POLARIDADE = [
  { value: 'MONOPOLAR', label: 'Monopolar' },
  { value: 'BIPOLAR', label: 'Bipolar' },
  { value: 'TRIPOLAR', label: 'Tripolar' }
];

export const SECTIONS = [
  {
    id: 'local',
    title: '1. Dados do local de instalação',
    fields: [
      { key: 'disjuntorGeralAmperagem', label: '1.1 Disjuntor geral da entrada (A)', type: 'text', inputmode: 'numeric', placeholder: 'Ex: 63A' },
      { key: 'disjuntorGeralTipo', label: 'Tipo do disjuntor geral', type: 'radio', options: RADIO_POLARIDADE },
      { key: 'padraoEntradaDps', label: '1.2 Padrão de entrada possui DPS instalado?', type: 'radio', options: RADIO_SIM_NAO },
      { key: 'sistemaInstaladoEm', label: '1.3 Sistema será instalado em', type: 'radio', options: [
        { value: 'TELHADO', label: 'Telhado' },
        { value: 'LAJE', label: 'Laje' },
        { value: 'SOLO', label: 'Solo' }
      ] },
      { key: 'sistemaInstaladoEmTelhadoTipo', label: 'Tipo de telhado (se aplicável)', type: 'text', placeholder: 'Ex: cerâmica, fibrocimento, metálico...', showIf: (d) => d.sistemaInstaladoEm === 'TELHADO' },
      { key: 'localInversor', label: '1.4 Local do inversor', type: 'radio', options: [
        { value: 'GARAGEM', label: 'Garagem' },
        { value: 'LAVANDERIA', label: 'Lavanderia' },
        { value: 'CORREDOR', label: 'Corredor' },
        { value: 'OUTRO', label: 'Outro' }
      ] },
      { key: 'localInversorOutro', label: 'Especifique o local', type: 'text', showIf: (d) => d.localInversor === 'OUTRO' }
    ]
  },
  {
    id: 'sistema',
    title: '2. Dados do sistema instalado',
    fields: [
      { key: 'potenciaModulos', label: '2.4 Potência dos módulos instalados', type: 'text', placeholder: 'Ex: 550W' },
      { key: 'qtdModulos', label: 'Quantidade de módulos', type: 'text', inputmode: 'numeric' },
      { key: 'snModulo', label: '2.5 SN do módulo', type: 'textarea', placeholder: 'Se houver vários, liste um por linha' },
      { key: 'qtdModulosPorString', label: '2.6 Quantidade de módulos por string', type: 'text' }
    ]
  },
  {
    id: 'materialCA',
    title: '3. Material CA',
    fields: [
      { key: 'disjuntorInstalacaoAmperagem', label: '3.1 Disjuntor utilizado na instalação (A)', type: 'text', inputmode: 'numeric' },
      { key: 'disjuntorInstalacaoTipo', label: 'Tipo do disjuntor', type: 'radio', options: RADIO_POLARIDADE },
      { key: 'bitolaCabeamentoCA', label: '3.2 Bitola de cabeamento utilizado', type: 'text', placeholder: 'Ex: 6mm²' },
      { key: 'metragemCabeamentoCA', label: 'Metragem utilizada (m)', type: 'text', inputmode: 'decimal' },
      { key: 'aterramentoRealizado', label: '3.3 Realizado aterramento do sistema?', type: 'radio', options: RADIO_SIM_NAO },
      { key: 'qtdEletrodutos', label: '3.4 Quantidade de eletrodutos utilizados', type: 'text', inputmode: 'numeric' },
      { key: 'dpsUtilizado', label: '3.5 DPS utilizado', type: 'text' },
      { key: 'dpsQuantidade', label: 'Quantidade de DPS', type: 'text', inputmode: 'numeric' }
    ]
  },
  {
    id: 'materialCC',
    title: '4. Material CC',
    fields: [
      { key: 'qtdMc4', label: '4.1 Quantidade de MC4 utilizados', type: 'text', inputmode: 'numeric' },
      { key: 'bitolaCabeamentoCC', label: '4.2 Bitola de cabeamento utilizado', type: 'text', placeholder: 'Ex: 4mm²' },
      { key: 'metragemCabeamentoCC', label: 'Metragem utilizada (m)', type: 'text', inputmode: 'decimal' }
    ]
  },
  {
    id: 'kit',
    title: '5. Kit do sistema fotovoltaico',
    fields: [
      { key: 'materialSobrouQual', label: 'Do sistema que veio do fornecedor, sobrou algum material? Qual?', type: 'textarea' }
    ]
  },
  {
    id: 'testes',
    title: '6. Testes após instalação',
    fields: [
      { key: 'possuiSinalInternet', label: '6.3 Possui sinal de internet no local?', type: 'radio', options: RADIO_SIM_NAO, group: 'Conectividade' },
      { key: 'monitoramentoConfigurado', label: 'Configurado o monitoramento?', type: 'radio', options: RADIO_SIM_NAO, group: 'Conectividade' }
    ]
  }
];

// Inversores e strings são repetíveis (pode haver mais de um inversor / mais de uma string)
export function emptyInversor() {
  return {
    potencia: '', snInversor: '', snDatalogger: '',
    testeFaseNeutro: '', testeFaseTerra: '', testeNeutroTerra: '', testeFaseFase: ''
  };
}

export function emptyString() {
  return { tensao: '', amperagem: '' };
}

// 7 - Registros fotográficos: categorias fixas do documento original
export const PHOTO_CATEGORIES = [
  { key: 'fotoPadraoEntrada', label: 'Padrão de entrada: disjuntor/medição' },
  { key: 'fotoLocalInversor', label: 'Local de instalação do inversor' },
  { key: 'fotoEtiquetaSnInversor', label: 'Etiqueta SN do inversor' },
  { key: 'fotoInstalacaoModulos', label: 'Instalação dos módulos' },
  { key: 'fotoEtiquetaModulos', label: 'Etiqueta dos módulos' },
  { key: 'fotoQuadroCaInversor', label: 'Quadro CA inversor' },
  { key: 'fotoAterramento', label: 'Aterramento' }
];

export function createEmptyData() {
  const data = {};
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      data[field.key] = '';
    }
  }
  data.clienteNome = '';
  data.clienteEndereco = '';
  data.appLogin = '';
  data.appSenha = '';
  data.observacoesTexto = '';
  data.executorNome = '';
  data.geo = null; // { lat, lng, accuracy, timestamp }
  data.inversores = [emptyInversor()];
  data.strings = [emptyString(), emptyString()];
  return data;
}
