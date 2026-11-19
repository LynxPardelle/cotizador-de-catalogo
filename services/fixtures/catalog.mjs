// Synthetic pilot data, never a real customer catalog.
export const syntheticCatalog = {
  catalogId:'oficina',name:'Oficina modular',version:1,
  currency:'MXN',currencyExponent:2,rounding:'half-up',validUntil:'2099-12-31T23:59:59.000Z',
  products:[
    {id:'desk',name:'Escritorio modular',basePriceMinor:'450000',options:[{id:'oak',name:'Roble',priceMinor:'80000'},{id:'white',name:'Blanco',priceMinor:'0'},{id:'assembly',name:'Instalación',priceMinor:'25000'}],incompatibleOptions:[['oak','white']]},
    {id:'chair',name:'Silla de trabajo',basePriceMinor:'150000',options:[{id:'arms',name:'Descansabrazos',priceMinor:'15000'}],incompatibleOptions:[]},
  ],
  rules:[{id:'volume5',type:'percentage-discount',minimumQuantity:5,numerator:'5',denominator:'100',priority:10}],
};
export const catalog = syntheticCatalog;
export default syntheticCatalog;
