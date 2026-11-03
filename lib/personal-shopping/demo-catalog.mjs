// Illustrations and claims in this catalog are invented examples, not retailer evidence.
const rows = [
 ['t01','Soft Everyday Tee','tops',29,['tag_free','flat_seams','sensory_softness'],['cotton'],['wool','latex'],['minimal'],'beige'],
 ['t02','Relaxed Layer Tee','tops',35,['tag_free','sensory_softness'],null,[],['sporty'],'blue'],
 ['t03','Airy Knit Top','tops',42,['temperature_comfort'],['linen'],['wool','latex','nickel_hardware'],['minimal'],'white'],
 ['s01','Easy Close Shirt','shirts',65,['easy_fastening','limited_dexterity','easy_dressing','magnetic_closure'],['cotton'],['wool','latex','nickel_hardware'],['classic'],'blue'],
 ['s02','Soft Seam Shirt','shirts',54,['flat_seams','sensory_softness'],['cotton'],['wool'],['minimal'],'white'],
 ['p01','Seated Cut Trouser','trousers',79,['seated_fit','easy_dressing','high_back_waist'],['cotton'],['wool','latex'],['classic'],'black'],
 ['p02','Pull On Trouser','trousers',55,['easy_fastening','limited_dexterity','adjustable_openings','side_zippers'],['viscose'],['wool','latex','nickel_hardware'],['sporty'],'green'],
 ['p03','Everyday Wide Leg','trousers',68,['easy_dressing','adjustable_openings'],null,[],['streetwear'],'beige'],
 ['d01','Easy Wrap Dress','dresses',89,['adjustable_openings','easy_dressing','hook_loop_fastening'],['linen'],['wool','latex','nickel_hardware'],['elegant'],'green'],
 ['d02','Soft Jersey Dress','dresses',72,['tag_free','sensory_softness','flat_seams'],['cotton'],['wool'],['minimal'],'pink'],
 ['j01','Large Pull Jacket','jackets',99,['easy_fastening','limited_dexterity','easy_dressing','easy_grip'],['polyester'],['wool','latex'],['sporty'],'blue'],
 ['j02','Easy Close Jacket','jackets',115,['easy_fastening','limited_dexterity','adjustable_openings','magnetic_zipper'],['cotton'],['wool','latex','nickel_hardware'],['minimal'],'beige'],
 ['j03','Relaxed Everyday Jacket','jackets',85,['easy_dressing','hook_loop_fastening'],null,[],['streetwear'],'black'],
 ['f01','Wide Opening Shoe','shoes',74,['adjustable_openings','easy_dressing','wide_opening'],null,['nickel_hardware'],['sporty'],'white'],
 ['f02','Slip On Shoe','shoes',69,['limited_dexterity','easy_fastening'],null,[],['minimal'],'black']
];
export const demoCatalog = rows.map(([id,title,category,price,features,materials,confirmed_absent,style,color]) => ({id:`sample-${id}`,title:`Sample ${title}`,brand:'Demo Studio',category,description:'Illustrative garment design.',image_url:null,features,materials,confirmed_absent,style,color,sizes:null,fit:null, evidence: [...features.map(attribute => ({attribute,value:true,evidence_type:'sample_data',evidence_text_or_source:'Illustrative sample specification',source_url:null,checked_at:null})),...confirmed_absent.map(attribute => ({attribute,value:'absent',evidence_type:'sample_data',evidence_text_or_source:'Illustrative sample declaration',source_url:null,checked_at:null}))],offers:[{source:'demo',source_item_id:id,retailer:'Demo retailer',price,currency:'EUR',product_url:null,shipping_cost:null,delivery_estimate:null,stock_status:'unknown',country:null,observed_at:null,last_checked_at:null}]}));
