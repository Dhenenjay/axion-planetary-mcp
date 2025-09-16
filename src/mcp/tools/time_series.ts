import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

register({
  name: 'create_time_series_chart_for_region',
  description: 'Monthly mean series over AOI',
  input: z.object({ datasetId: z.string(), aoi: z.any(), band: z.string() }),
  output: z.object({ series: z.array(z.object({ t:z.string(), value:z.number().nullable() })) }),
  handler: async ({ datasetId, aoi, band }) => {
    const region = await parseAoi(aoi);
    const col = new ee.ImageCollection(datasetId)
      .map((img: any) => img.set('date', img.date().format('YYYY-MM')))
      .select(band);
    const months = new ee.List(col.aggregate_array('date')).distinct();
    const series = await months.map((m:any)=>{
      const c = col.filter(ee.Filter.eq('date', m));
      const v = new ee.Image(c.mean()).reduceRegion({ reducer: ee.Reducer.mean(), geometry: region, scale: 30, maxPixels:1e8 }).get(band);
      return new ee.Dictionary({ t:m, value:v });
    }).getInfo();
    return { series };
  },
});
