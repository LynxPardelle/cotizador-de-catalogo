export class DomainError extends Error {
  constructor(code,message,statusCode=400) { super(message); this.name='DomainError'; this.code=code; this.statusCode=statusCode; }
}
const failCatalog=message=>{throw new DomainError('INVALID_CATALOG',message);};
const failRequest=message=>{throw new DomainError('INVALID_CONFIGURATION',message);};
const isObject=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const identifier=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const name=value=>typeof value==='string' && value.trim().length>0 && value.length<=120;
const integer=(value,min,max)=>Number.isSafeInteger(value) && value>=min && value<=max;
const money=value=>typeof value==='string' && /^(0|[1-9][0-9]{0,23})$/.test(value);
const unique=values=>new Set(values).size===values.length;
const currencies={MXN:2,USD:2,EUR:2,JPY:0,KWD:3};
const compareId=(a,b)=>a<b ? -1 : a>b ? 1 : 0;

export function validateCatalog(catalog) {
  if(!isObject(catalog) || !identifier(catalog.catalogId) || !name(catalog.name) || !integer(catalog.version,1,999_999_999)) failCatalog('Identidad o versión de catálogo inválida.');
  if(!Object.hasOwn(currencies,catalog.currency) || currencies[catalog.currency]!==catalog.currencyExponent) failCatalog('Moneda o exponente monetario no admitido.');
  if(!['half-up','half-even','down'].includes(catalog.rounding)) failCatalog('La política de redondeo no es válida.');
  if(typeof catalog.validUntil!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(catalog.validUntil) || !Number.isFinite(Date.parse(catalog.validUntil))) failCatalog('La vigencia debe ser una fecha ISO UTC.');
  const canonicalDate=catalog.validUntil.includes('.') ? catalog.validUntil : catalog.validUntil.replace('Z','.000Z');
  if(new Date(catalog.validUntil).toISOString()!==canonicalDate) failCatalog('La vigencia contiene una fecha o una hora que no existe.');
  if(!Array.isArray(catalog.products) || catalog.products.length<1 || catalog.products.length>100 || !unique(catalog.products.map(product=>product?.id))) failCatalog('El catálogo necesita entre 1 y 100 productos únicos.');
  for(const product of catalog.products) {
    if(!isObject(product) || !identifier(product.id) || !name(product.name) || !money(product.basePriceMinor)) failCatalog('Producto o precio base inválido.');
    if(!Array.isArray(product.options) || product.options.length>20 || !unique(product.options.map(option=>option?.id))) failCatalog('Las opciones deben tener identificadores únicos.');
    for(const option of product.options) if(!isObject(option) || !identifier(option.id) || !name(option.name) || !money(option.priceMinor)) failCatalog('Opción o recargo inválido.');
    const optionIds=new Set(product.options.map(option=>option.id));
    if(!Array.isArray(product.incompatibleOptions) || product.incompatibleOptions.length>100) failCatalog('Las incompatibilidades no son válidas.');
    for(const pair of product.incompatibleOptions) if(!Array.isArray(pair) || pair.length!==2 || pair[0]===pair[1] || pair.some(id=>!optionIds.has(id))) failCatalog('Una incompatibilidad refiere opciones desconocidas.');
  }
  if(!Array.isArray(catalog.rules) || catalog.rules.length>50 || !unique(catalog.rules.map(rule=>rule?.id))) failCatalog('Las reglas deben tener identificadores únicos.');
  for(const rule of catalog.rules) {
    if(!isObject(rule) || !identifier(rule.id) || !['percentage-discount','percentage-surcharge'].includes(rule.type) || !integer(rule.minimumQuantity,1,1_000_000) || !integer(rule.priority,0,10_000)) failCatalog('Tipo, umbral o prioridad de regla inválida.');
    if(!money(rule.numerator) || !money(rule.denominator) || BigInt(rule.denominator)===0n || BigInt(rule.numerator)>BigInt(rule.denominator)) failCatalog('La razón de una regla debe estar entre cero y uno.');
  }
  return catalog;
}

function rounded(numerator,denominator,mode) {
  const quotient=numerator/denominator;
  const remainder=numerator%denominator;
  if(mode==='down') return quotient;
  if(remainder*2n>denominator) return quotient+1n;
  if(remainder*2n<denominator) return quotient;
  return mode==='half-up' || quotient%2n===1n ? quotient+1n : quotient;
}

export function calculatePrice(catalog,request,{now=new Date()}={}) {
  validateCatalog(catalog);
  if(!isObject(request) || request.catalogId!==catalog.catalogId || request.version!==catalog.version || request.currency!==catalog.currency) failRequest('Catálogo, versión o moneda no coincide.');
  const timestamp=new Date(now).getTime();
  if(!Number.isFinite(timestamp)) failRequest('La fecha de cálculo no es válida.');
  if(timestamp>=Date.parse(catalog.validUntil)) throw new DomainError('CATALOG_EXPIRED','La versión del catálogo ha caducado.',409);
  if(!Array.isArray(request.items) || request.items.length<1 || request.items.length>100 || !unique(request.items.map(item=>item?.productId))) failRequest('Configura entre 1 y 100 productos diferentes.');
  let subtotal=0n; let quantity=0;
  const lines=request.items.map(item=>{
    if(!isObject(item) || !identifier(item.productId) || !integer(item.quantity,1,10_000) || !Array.isArray(item.optionIds) || item.optionIds.length>20 || !unique(item.optionIds)) failRequest('Las cantidades deben ser enteras entre 1 y 10 000 y las opciones únicas.');
    const product=catalog.products.find(product=>product.id===item.productId);
    if(!product) failRequest('El producto no existe en la versión seleccionada.');
    const optionIds=[...item.optionIds].sort();
    const selectedOptions=[];
    let unit=BigInt(product.basePriceMinor);
    for(const id of optionIds) {
      const option=product.options.find(option=>option.id===id);
      if(!option) failRequest('La opción no existe en el producto seleccionado.');
      unit+=BigInt(option.priceMinor);
      selectedOptions.push({id:option.id,name:option.name,priceMinor:option.priceMinor});
    }
    if(product.incompatibleOptions.some(pair=>pair.every(id=>optionIds.includes(id)))) failRequest('La configuración contiene opciones incompatibles.');
    const total=unit*BigInt(item.quantity);
    subtotal+=total; quantity+=item.quantity;
    return {productId:product.id,name:product.name,quantity:item.quantity,optionIds,selectedOptions,unitPriceMinor:unit.toString(),totalMinor:total.toString()};
  });
  lines.sort((a,b)=>compareId(a.productId,b.productId));
  let total=subtotal;
  const appliedRules=[];
  const rules=[...catalog.rules].sort((a,b)=>a.priority-b.priority || compareId(a.id,b.id));
  for(const rule of rules) if(quantity>=rule.minimumQuantity) {
    let amount=rounded(total*BigInt(rule.numerator),BigInt(rule.denominator),catalog.rounding);
    if(rule.type==='percentage-discount') amount=-amount;
    total+=amount;
    appliedRules.push({id:rule.id,type:rule.type,priority:rule.priority,amountMinor:amount.toString(),description:`${rule.type==='percentage-discount'?'Descuento':'Recargo'} ${rule.numerator}/${rule.denominator} desde ${rule.minimumQuantity} unidades`});
  }
  return {catalogId:catalog.catalogId,version:catalog.version,currency:catalog.currency,currencyExponent:catalog.currencyExponent,validUntil:catalog.validUntil,subtotalMinor:subtotal.toString(),totalMinor:total.toString(),lines,appliedRules};
}
