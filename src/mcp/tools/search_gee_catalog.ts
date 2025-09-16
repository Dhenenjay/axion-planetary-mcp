import { register, z } from '../registry';
register({
  name: 'search_gee_catalog',
  description: 'Search GEE datasets by a free-text query (id/title/provider)',
  input: z.object({ query: z.string().min(2) }),
  output: z.object({ hits: z.array(z.object({ id:z.string(), title:z.string().optional(), provider:z.string().optional(), bands:z.array(z.string()).optional() })) }),
  handler: async ({ query }) => {
    // Placeholder: return curated ids matching the query; replace with real catalog endpoint in your repo
    const curated = [{ id:'COPERNICUS/S2_SR', title:'Sentinel-2 SR', provider:'ESA' }, { id:'LANDSAT/LC09/C02/T1_L2', title:'Landsat 9 L2', provider:'USGS' }];
    const hits = curated.filter(x=> (x.id+x.title+x.provider).toLowerCase().includes(query.toLowerCase()));
    return { hits };
  },
});
