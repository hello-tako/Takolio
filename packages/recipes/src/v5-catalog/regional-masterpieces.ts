import type { Recipe } from '../types';

const DISH_IMG = (slug: string) => `/takolio/v5/dishes/${slug}.webp`;

/**
 * 85 Chef-Crafted Authentic Vietnamese 3-Region Masterpiece Recipes (Takolio V5):
 * - 30 Miền Bắc (`v5-bac-01` .. `v5-bac-30`)
 * - 28 Miền Trung (`v5-trung-01` .. `v5-trung-28`)
 * - 27 Miền Nam (`v5-nam-01` .. `v5-nam-27`)
 */
export const REGIONAL_MASTERPIECES_V5: Recipe[] = [
  // ===========================================================================
  // MIỀN BẮC (30 MASTERPIECES: v5-bac-01 .. v5-bac-30)
  // ===========================================================================
  {
    id: 'v5-bac-01',
    slug: 'bun-cha-ha-noi-kep-tre',
    title: 'Bún chả Hà Nội kẹp tre nướng than hoa',
    description: 'Chả miếng ba chỉ và chả viên nạc vai kẹp tre tươi nướng xém cạnh thơm khói, thả ngập bát nước mắm chua ngọt ấm nóng cùng đu đủ xanh giòn.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-cha-ha-noi'),
    nutrition: { calories: 525, proteinG: 31, fatG: 24, carbG: 46 },
    tags: ['Miền Bắc', 'Hà Nội', 'Bún chả', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ thái lát mỏng', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai xay dẻo', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún tươi sợi nhỏ', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'GREEN_PAPAYA', name: 'Đu đủ xanh thái lát mỏng', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'SHALLOT', name: 'Hành khô & tỏi băm', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt truyền thống', requiredQuantity: 50, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp thịt ba chỉ và thịt nạc vai xay riêng với nước cốt hành tỏi, 20ml nước mắm, chút mật ong và hạt tiêu trong 20 phút.', tip: 'Vắt lấy nước cốt hành tỏi giúp thịt nướng thơm lừng mà không bị cháy khét xác tỏi.', timerMinutes: 20 },
      { stepNumber: 2, instruction: 'Nặn thịt xay thành viên tròn dẹt, kẹp vỉ nướng trên than hoa hoặc lò 200°C trong 12 phút đến khi vàng xém cạnh.', timerMinutes: 12 },
      { stepNumber: 3, instruction: 'Bóp đu đủ xanh với chút muối, rửa sạch rồi ngâm giấm đường 10 phút làm dưa góp giòn sần sật.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Đun ấm hỗn hợp nước lọc, 30ml nước mắm, đường và giấm thanh cho vị chua ngọt dịu nhẹ, thả dưa góp và chả nướng nóng vào bát.' },
      { stepNumber: 5, instruction: 'Dọn bát chả nướng bốc khói kèm bún rối trắng ngần và rổ rau sống tía tô, kinh giới, húng Láng.' }
    ]
  },
  {
    id: 'v5-bac-02',
    slug: 'cha-ca-la-vong-pho-co',
    title: 'Chả cá Lã Vọng nướng nghệ thì là Hà Nội',
    description: 'Phi lê cá lăng ướp riềng nghệ mẻ vàng ươm, đảo nóng tại bàn trên chảo mỡ sôi cùng rừng thì là, hành hoa chẻ và lạc rang bùi.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('ca-chien-mam-gung'),
    nutrition: { calories: 440, proteinG: 36, fatG: 22, carbG: 24 },
    tags: ['Miền Bắc', 'Hà Nội', 'Chả cá', 'Tinh hoa'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Phi lê cá lăng cắt miếng vuông', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'DILL', name: 'Thì là tươi & hành hoa cắt khúc', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi & riềng giã lọc nước', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún rối tươi', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'SHRIMP_PASTE', name: 'Mắm tôm ngon đánh bông chanh', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'COOKING_OIL', name: 'Mỡ nước hoặc dầu ăn', requiredQuantity: 35, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp miếng cá lăng với nước cốt riềng nghệ, chút mắm tôm và tiêu xay trong 25 phút cho thấm màu vàng nghệ.', tip: 'Thêm 1 thìa sữa chua không đường thay mẻ giúp thịt cá mềm ngọt và dậy hương thanh.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Xếp cá lên vỉ nướng ở 200°C trong 10 phút cho hai mặt cá săn vàng thơm phức.', timerMinutes: 10 },
      { stepNumber: 3, instruction: 'Pha mắm tôm cùng nước cốt chanh, chút đường và vài giọt rượu trắng, đánh bông sủi bọt tím nhạt.' },
      { stepNumber: 4, instruction: 'Đun nóng dầu ăn trên chảo gang, trút cá nướng cùng thì là và đầu hành chẻ vào đảo nhẹ 2 phút cho rau chín tái.', timerMinutes: 2 },
      { stepNumber: 5, instruction: 'Gắp cá nóng ra bát bún rối, rắc lạc rang nguyên hạt và rưới mắm tôm thưởng thức ngay.' }
    ]
  },
  {
    id: 'v5-bac-03',
    slug: 'ca-chep-om-dua-bac-bo',
    title: 'Cá chép om dưa cải chua tóp mỡ Bắc Bộ',
    description: 'Cá chép tươi dày thịt chiên săn vàng, om liu riu trong nước dưa cải chua dịu thanh tao điểm xuyết tóp mỡ giòn và thì là thơm ngát.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('ca-kho-to'),
    nutrition: { calories: 390, proteinG: 34, fatG: 20, carbG: 14 },
    tags: ['Miền Bắc', 'Món om', 'Cá chép', 'Ấm cúng'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá chép tươi nguyên con khía vảy', requiredQuantity: 700, unit: 'g' },
      { ingredientId: 'MUSTARD_GREENS', name: 'Dưa cải bẹ muối chua vàng', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt mỡ ba chỉ thắng tóp mỡ', requiredQuantity: 120, unit: 'g' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín bổ múi cau', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'DILL', name: 'Hành hoa & thì là tươi', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt ngon', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Làm sạch màng đen bụng cá chép với muối gừng, thấm thật khô rồi khía nhẹ chéo hai bên mình cá.', tip: 'Cạo sạch lớp màng đen trong bụng cá là bí quyết khử triệt để mùi tanh bùn.' },
      { stepNumber: 2, instruction: 'Thắng ba chỉ lấy tóp mỡ vàng giòn, dùng chính chảo mỡ đó chiên sơ cá chép 6 phút cho săn vàng hai mặt.', timerMinutes: 6 },
      { stepNumber: 3, instruction: 'Phi hành khô, xào mềm cà chua và dưa cải chua cùng 20ml nước mắm trong 5 phút cho tiết vị chua ngọt.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Đổ 600ml nước sôi và nước chua dưa vào nồi, đặt cá chép lên trên om lửa nhỏ 20 phút cho cá ngấm đậm vị.', timerMinutes: 20 },
      { stepNumber: 5, instruction: 'Rắc tóp mỡ giòn, hành hoa và thì là cắt khúc lên mặt cá, dọn nóng kèm bún hoặc cơm trắng.' }
    ]
  },
  {
    id: 'v5-bac-04',
    slug: 'thit-dong-moc-nhi-ha-noi',
    title: 'Thịt đông chân giò mộc nhĩ tiêu sọ Hà Nội',
    description: 'Món ngon cổ truyền mùa lạnh miền Bắc với lớp thạch thịt trong veo như hổ phách, quyện chân giò mềm sần sật và nấm hương mộc nhĩ thơm bùi.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'bac',
    cookTimeMinutes: 55,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('thit-luoc-ca-phao'),
    nutrition: { calories: 365, proteinG: 29, fatG: 25, carbG: 6 },
    tags: ['Miền Bắc', 'Cỗ Tết', 'Thịt đông', 'Cổ truyền'],
    ingredients: [
      { ingredientId: 'PORK_HOCK', name: 'Thịt chân giò rút xương & bì thăn', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Mộc nhĩ & nấm hương rừng ngâm nở', requiredQuantity: 60, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành khô băm thơm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm truyền thống', requiredQuantity: 30, unit: 'ml' },
      { ingredientId: 'BLACK_PEPPER', name: 'Hạt tiêu sọ đập dập', requiredQuantity: 5, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần thịt chân giò và bì heo qua nước sôi gừng 3 phút, rửa sạch lại với nước ấm rồi thái miếng vuông vừa ăn.', timerMinutes: 3 },
      { stepNumber: 2, instruction: 'Ướp thịt với nước mắm, hành khô băm và nửa lượng tiêu sọ đập dập trong 15 phút.', timerMinutes: 15 },
      { stepNumber: 3, instruction: 'Xào săn thịt chân giò, châm ngập nước sôi rồi ninh lửa thật nhỏ 35 phút đồng thời hớt sạch bọt để nước trong vắt.', tip: 'Hớt bọt liên tục và không khuấy mạnh giúp phần thạch đông trong veo như pha lê.', timerMinutes: 35 },
      { stepNumber: 4, instruction: 'Thả nấm hương và mộc nhĩ thái sợi vào đun thêm 7 phút, rắc nốt phần tiêu sọ thơm nồng.', timerMinutes: 7 },
      { stepNumber: 5, instruction: 'Múc thịt và nước dùng ra bát sứ, để nguội rồi cất ngăn mát cho đông mịn, úp ngược ra đĩa ăn kèm dưa hành muối.' }
    ]
  },
  {
    id: 'v5-bac-05',
    slug: 'nem-cua-be-hai-phong',
    title: 'Nem cua bể Hải Phòng gói vuông giòn rụm',
    description: 'Chiếc nem gói vuông vức chuẩn đất Cảng với vỏ bánh đa giòn tan, nhân đầy ắp thịt cua bể tươi gỡ tay, tôm nõn và nấm hương thơm ngậy.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'hard',
    imageUrl: DISH_IMG('nem-ran-cha-gio'),
    nutrition: { calories: 410, proteinG: 26, fatG: 21, carbG: 29 },
    tags: ['Miền Bắc', 'Hải Phòng', 'Nem vuông', 'Hải sản'],
    ingredients: [
      { ingredientId: 'CRAB_MEAT', name: 'Thịt cua bể tươi gỡ múi', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai heo xay', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'CHICKEN_EGG', name: 'Trứng gà ta', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm hương & mộc nhĩ thái nhỏ', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh đa nem làng Lều gói vuông', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn chiên hai lửa', requiredQuantity: 100, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Trộn thịt vai xay, nấm hương, mộc nhĩ, giá đỗ, lòng đỏ trứng và tiêu trước, sau cùng mới nhẹ tay trộn múi thịt cua để không nát.' },
      { stepNumber: 2, instruction: 'Phết nước pha chút giấm đường lên bánh đa nem cho dẻo, xếp nhân vào giữa và gấp vuông 4 cạnh đều đặn.', tip: 'Phết chút giấm đường hoặc bia lên vỏ bánh giúp nem khi rán lên màu vàng hổ phách giòn lâu.' },
      { stepNumber: 3, instruction: 'Chiên nem lửa vừa lần 1 trong 8 phút cho nhân chín đều từ trong rồi vớt ra giá thưa để ráo.', timerMinutes: 8 },
      { stepNumber: 4, instruction: 'Chiên lại lần 2 trên lửa lớn trong 2 phút ngay trước khi ăn để vỏ nem giòn rụm ráo dầu.', timerMinutes: 2 },
      { stepNumber: 5, instruction: 'Cắt chéo chiếc nem vuông làm tư lộ nhân cua đầy đặn, ăn kèm bún rối, rau sống và mắm chua ngọt.' }
    ]
  },
  {
    id: 'v5-bac-06',
    slug: 'bun-thang-pho-co-ha-noi',
    title: 'Bún thang Hà Nội trứng thái chỉ thanh tao',
    description: 'Kiệt tác tinh tế bậc nhất ẩm thực Kinh Kỳ với nước dùng gà tôm khô trong veo, bày ngũ sắc trứng rán mỏng, giò lụa, lườn gà xé và nấm hương.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'bac',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'hard',
    imageUrl: DISH_IMG('pho-bo-ha-noi'),
    nutrition: { calories: 420, proteinG: 34, fatG: 12, carbG: 44 },
    tags: ['Miền Bắc', 'Hà Nội', 'Bún thang', 'Tinh tế'],
    ingredients: [
      { ingredientId: 'CHICKEN_BREAST', name: 'Thịt gà ta luộc xé sợi nhỏ', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'DRIED_SHRIMP', name: 'Tôm khô ninh nước & giã bông', requiredQuantity: 50, unit: 'g' },
      { ingredientId: 'CHICKEN_EGG', name: 'Trứng gà tráng thật mỏng thái chỉ', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'NOODLE', name: 'Bún sợi nhỏ trắng mềm', requiredQuantity: 450, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm hương rừng ngâm nở', requiredQuantity: 35, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt ngon', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ninh xương gà cùng tôm khô rửa sạch và nấm hương trên lửa liu riu 25 phút, vớt bọt kỹ để nước dùng trong vắt ngọt sâu.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Đánh tan trứng gà với chút rượu trắng, láng chảo tráng lớp trứng mỏng như tờ giấy rồi cuộn thái sợi tơ mảnh.', tip: 'Pha vài giọt rượu trắng và bột năng loãng giúp lớp trứng tráng dai mỏng không bị rách khi thái chỉ.' },
      { stepNumber: 3, instruction: 'Xé nhỏ thịt gà luộc và giã tơi một nửa lượng tôm khô đã hấp mềm làm ruốc tôm bông hồng.' },
      { stepNumber: 4, instruction: 'Chần bún sợi nhỏ xếp vào bát chiết yêu, chia năm góc bày gà xé, trứng chỉ, nấm hương, ruốc tôm đều tăm tắp.' },
      { stepNumber: 5, instruction: 'Chan nước dùng đang sôi sùng sục ngập bát bún, rắc hành hoa rau răm thái mịn thưởng thức nóng.' }
    ]
  },
  {
    id: 'v5-bac-07',
    slug: 'gia-cay-rieng-me-bac-bo',
    title: 'Giả cầy chân giò thui rơm nấu riềng mẻ',
    description: 'Chân giò heo thui vàng bì giòn sần sật, ướp đẫm riềng giã, nghệ tươi, mẻ chua và mắm tôm ninh sánh quyện thơm lừng góc bếp Bắc Bộ.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bo-kho-banh-mi'),
    nutrition: { calories: 470, proteinG: 32, fatG: 31, carbG: 14 },
    tags: ['Miền Bắc', 'Giả cầy', 'Đậm đà', 'Mùa đông'],
    ingredients: [
      { ingredientId: 'PORK_HOCK', name: 'Chân giò heo thui vàng chặt miếng', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'GALANGAL', name: 'Củ riềng bánh tẻ giã nhỏ', requiredQuantity: 80, unit: 'g' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã vắt nước', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'SHRIMP_PASTE', name: 'Mắm tôm cốt thơm', requiredQuantity: 25, unit: 'g' },
      { ingredientId: 'RICE_VINEGAR', name: 'Cơm mẻ lọc mịn / Giấm bỗng', requiredQuantity: 40, unit: 'ml' },
      { ingredientId: 'SCALLION', name: 'Hành hoa & rau răm', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Khò hoặc áp chảo lớp bì chân giò đến khi xém nâu dậy mùi khói thơm, cạo rửa sạch rồi chặt miếng vừa ăn.' },
      { stepNumber: 2, instruction: 'Ướp chân giò với riềng giã, nước nghệ, mẻ lọc mịn và mắm tôm trong 30 phút cho ngấm sâu từng thớ thịt.', tip: 'Ướp đủ thời gian giúp vị chua thanh của mẻ làm mềm bì giò mà vẫn giữ độ giòn sần sật.', timerMinutes: 30 },
      { stepNumber: 3, instruction: 'Bắc nồi lên bếp xào săn chân giò trên lửa vừa 5 phút cho dậy mùi riềng mẻ quyện mắm tôm.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Châm nước sôi xâm xấp mặt thịt, đậy nắp om lửa nhỏ 30 phút đến khi nước sốt sánh vàng óng ả.', timerMinutes: 30 },
      { stepNumber: 5, instruction: 'Rắc hành hoa và rau răm thái khúc, múc nóng ra bát ăn kèm bún lá hoặc cơm nóng.' }
    ]
  },
  {
    id: 'v5-bac-08',
    slug: 'suon-xao-chua-ngot-ha-thanh',
    title: 'Sườn xào chua ngọt Hà Thành bóng mượt',
    description: 'Sườn thăn non rán vàng cạnh rim chậm trong nước mắm giấm đường thắng kẹo tự nhiên, không dùng tương công nghiệp, chua thanh ngọt dịu.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('suon-xao-chua-ngot'),
    nutrition: { calories: 430, proteinG: 29, fatG: 26, carbG: 20 },
    tags: ['Miền Bắc', 'Hà Nội', 'Cơm nhà', 'Đưa cơm'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn non thăn chặt miếng vừa', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'GARLIC', name: 'Tỏi ta & hành khô băm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'RICE_VINEGAR', name: 'Giấm gạo thanh dịu', requiredQuantity: 30, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát trắng', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 30, unit: 'ml' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn rán sườn', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần sườn non qua nước sôi muối 2 phút, rửa sạch thấm khô để khi rán không bị bắn dầu.', timerMinutes: 2 },
      { stepNumber: 2, instruction: 'Áp chảo sườn với dầu ăn trên lửa vừa 8 phút đến khi hai mặt sườn xém vàng thơm.', timerMinutes: 8 },
      { stepNumber: 3, instruction: 'Khuấy tan bát sốt Hà Thành theo tỉ lệ vàng: 30ml nước mắm, 30g đường, 30ml giấm gạo và 60ml nước ấm.', tip: 'Cách làm chuẩn Hà Nội xưa không cho cà chua hay ớt chuông để nước sốt trong bóng màu cánh gián.' },
      { stepNumber: 4, instruction: 'Phi thơm hành tỏi băm, đổ bát sốt vào sườn đun nhỏ lửa 12 phút đến khi sốt kẹo sánh bám bóng quanh dẻ sườn.', timerMinutes: 12 },
      { stepNumber: 5, instruction: 'Bày sườn nóng ra đĩa sứ trắng, rắc chút tiêu xay và dùng ngay với cơm dẻo nóng.' }
    ]
  },
  {
    id: 'v5-bac-09',
    slug: 'dau-phu-tam-hanh-ha-noi',
    title: 'Đậu phụ Mơ rán giòn tẩm hành hoa Hà Nội',
    description: 'Những bìa đậu Mơ béo ngậy rán phồng vàng rụm, nhúng nhanh vào bát nước mắm hành hoa xanh ngắt mặn ngọt hài hòa chuẩn mâm cơm Bắc.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'bac',
    cookTimeMinutes: 15,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('dau-phu-sot-ca'),
    nutrition: { calories: 225, proteinG: 16, fatG: 14, carbG: 8 },
    tags: ['Miền Bắc', 'Đậu tẩm hành', 'Dưới 20 phút', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'TOFU', name: 'Đậu phụ Mơ trắng mềm', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành hoa tươi thái nhỏ', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm truyền thống', requiredQuantity: 25, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát', requiredQuantity: 10, unit: 'g' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn rán đậu', requiredQuantity: 45, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cắt đậu phụ thành miếng vuông dày 2cm, trải trên khăn sạch thấm thật ráo nước bề mặt.' },
      { stepNumber: 2, instruction: 'Khuấy đều 25ml nước mắm, 10g đường và 50ml nước đun sôi để nguội trong tô rộng, thả thật nhiều hành hoa thái nhỏ vào.' },
      { stepNumber: 3, instruction: 'Đun dầu sôi già, thả đậu vào rán lửa vừa lớn 7 phút đến khi các mặt vàng phồng giòn rụm.', timerMinutes: 7 },
      { stepNumber: 4, instruction: 'Gắp ngay từng miếng đậu đang nóng bỏng nhúng thẳng vào tô mắm hành lật đều 5 giây rồi vớt ra đĩa.', tip: 'Nhúng lúc đậu vừa rời chảo dầu nóng giúp vỏ đậu hút mắm xèo nhẹ làm chín tái hành hoa thơm nức mà vẫn giữ độ giòn.' }
    ]
  },
  {
    id: 'v5-bac-10',
    slug: 'canh-sau-thit-bam-ha-noi',
    title: 'Canh sấu dầm thịt băm cà chua thanh mát',
    description: 'Bát canh giải nhiệt mùa hạ đặc trưng Hà Nội với vị chua thanh dìu dịu của trái sấu non dầm quyện nước thịt nạc băm ngọt lành.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'bac',
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-chua-ca'),
    nutrition: { calories: 195, proteinG: 18, fatG: 8, carbG: 12 },
    tags: ['Miền Bắc', 'Hà Nội', 'Mùa hè', 'Thanh nhiệt'],
    ingredients: [
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai heo băm nhỏ', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín bổ múi cau', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'TAMARIND', name: 'Sấu xanh cạo vỏ / Quả chua', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành khô băm thơm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành hoa & rau mùi tàu', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp thịt nạc băm với 10ml nước mắm và chút hành khô băm trong 5 phút cho đậm đà.', timerMinutes: 5 },
      { stepNumber: 2, instruction: 'Phi thơm hành khô trên nồi nóng, trút thịt băm và một nửa cà chua vào xào săn lên màu cam đỏ đẹp mắt.' },
      { stepNumber: 3, instruction: 'Đổ 1 lít nước sôi cùng quả sấu cạo vỏ vào đun lửa vừa 10 phút đến khi sấu chín mềm.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Vớt sấu ra bát dầm nát lấy nước cốt chua thanh lọc lại vào nồi, thả nốt cà chua múi cau đun thêm 2 phút.', tip: 'Dầm sấu riêng ngoài bát rồi gạn lấy nước giúp điều chỉnh độ chua vừa ý mà nước canh không bị đục.', timerMinutes: 2 },
      { stepNumber: 5, instruction: 'Nêm lại nước mắm vừa miệng, rắc hành hoa thái nhỏ và múc ra tô dùng với cơm nóng.' }
    ]
  },
  {
    id: 'v5-bac-11',
    slug: 'pho-ga-ta-la-chanh-ha-noi',
    title: 'Phở gà ta da giòn lá chanh phố cổ',
    description: 'Bát phở gà thanh khiết chuẩn vị Hà Nội với lát thịt gà mái dầu da vàng giòn, nước dùng trong ngọt thảo mộc và lá chanh thái chỉ thơm lừng.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'bac',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('pho-bo-ha-noi'),
    nutrition: { calories: 455, proteinG: 35, fatG: 13, carbG: 50 },
    tags: ['Miền Bắc', 'Phở gà', 'Hà Nội', 'Ăn sáng'],
    ingredients: [
      { ingredientId: 'CHICKEN_THIGH', name: 'Thịt gà ta nguyên đùi và lườn', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bánh phở tươi sợi mềm', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng già nướng thơm đập dập', requiredQuantity: 35, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành khô nướng bóc vỏ', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'LIME_LEAF', name: 'Lá chanh non thái chỉ mảnh', requiredQuantity: 5, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cho gà vào nồi nước lạnh ngập mình cùng chút muối, đun sôi lăn tăn lửa nhỏ 20 phút rồi tắt bếp ngâm thêm 10 phút cho da căng bóng.', tip: 'Luộc gà từ nước lạnh và ngâm ủ giúp thịt gà chín mọng tới xương mà da không bị nứt.', timerMinutes: 30 },
      { stepNumber: 2, instruction: 'Vớt gà ngâm ngay vào âu nước đá lạnh 5 phút để da giòn sần sật, sau đó lọc thịt thái miếng mỏng bản to.' },
      { stepNumber: 3, instruction: 'Cho xương gà trở lại nồi nước luộc cùng gừng nướng, hành nướng và chút hạt mùi rang, ninh nhỏ lửa 15 phút.', timerMinutes: 15 },
      { stepNumber: 4, instruction: 'Chần bánh phở nóng xếp vào bát, bày thịt gà da vàng lên mặt kèm hành hoa chẻ và rau mùi.' },
      { stepNumber: 5, instruction: 'Chan ngập nước dùng trong vắt đang sôi, rắc vài sợi lá chanh non và vắt quất ớt thưởng thức.' }
    ]
  },
  {
    id: 'v5-bac-12',
    slug: 'bun-oc-giambong-ha-thanh',
    title: 'Bún ốc giấm bỗng cà chua tía tô Hà Thành',
    description: 'Ốc nhồi béo giòn xào nghệ vàng ươm, chan nước dùng cà chua giấm bỗng nếp thanh chua dịu dàng, thơm nồng tía tô hành hoa.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'bac',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 395, proteinG: 26, fatG: 9, carbG: 52 },
    tags: ['Miền Bắc', 'Bún ốc', 'Hà Nội', 'Giấm bỗng'],
    ingredients: [
      { ingredientId: 'SNAIL', name: 'Thịt ốc nhồi làm sạch giòn', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún tươi sợi nhỏ', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'TOMATO', name: 'Cà chua đỏ chín bổ múi cau', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'FERMENTED_RICE_VINEGAR', name: 'Giấm bỗng rượu nếp thơm', requiredQuantity: 60, unit: 'ml' },
      { ingredientId: 'PERILLA', name: 'Lá tía tô & hành hoa thái nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Bóp sạch nhớt thịt ốc với muối hạt và giấm, rửa kỹ rồi ướp chút nghệ giã và nước mắm 10 phút.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Phi hành khô thơm lừng, cho ốc vào xào lửa lớn thật nhanh trong 2 phút cho săn giòn rồi trút riêng ra bát.', tip: 'Không xào ốc quá lâu trên bếp kẻo thịt ốc bị quắt và dai cứng.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Xào cà chua tạo màu đỏ cam, đổ 1.2 lít nước dùng xương vào đun sôi rồi nêm giấm bỗng nếp và nước mắm.', timerMinutes: 8 },
      { stepNumber: 4, instruction: 'Chần bún vào tô, lót hành hoa và tía tô thái chỉ, xúc thịt ốc vàng giòn bày lên trên.' },
      { stepNumber: 5, instruction: 'Chan nước canh giấm bỗng nóng hổi, thêm chút ớt chưng cay nồng ăn kèm rau sống.' }
    ]
  },
  {
    id: 'v5-bac-13',
    slug: 'cha-ruoi-vo-quyt-ha-noi',
    title: 'Chả rươi thịt băm vỏ quýt thì là Hà Nội',
    description: 'Thức quà thu đông trứ danh đất Bắc rán vàng phồng xốp béo ngậy, dậy hương tinh dầu vỏ quýt hôi hòa quyện lá lốt và thì là tươi.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'bac',
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('trung-chien-thit'),
    nutrition: { calories: 335, proteinG: 25, fatG: 23, carbG: 7 },
    tags: ['Miền Bắc', 'Chả rươi', 'Mùa thu', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai xay lẫn mỡ mềm', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'CHICKEN_EGG', name: 'Trứng gà ta tươi', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'DILL', name: 'Thì là & hành hoa thái mịn', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'LIME_LEAF', name: 'Vỏ quýt tươi & lá gừng băm nhỏ', requiredQuantity: 10, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 20, unit: 'ml' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn hoặc mỡ heo', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cho thịt xay vào âu lớn cùng trứng gà ta, dùng đũa đánh bông đều đến khi hỗn hợp sánh mịn.' },
      { stepNumber: 2, instruction: 'Thêm vỏ quýt băm thật nhuyễn, thì là, hành hoa, nước mắm và hạt tiêu xay vào khuấy quyện.', tip: 'Tinh dầu vỏ quýt tươi là linh hồn giúp món chả thơm thanh thoát và ấm bụng.' },
      { stepNumber: 3, instruction: 'Đun nóng dầu trên chảo phẳng, múc từng muôi chả vào dàn tròn vừa phải, rán lửa nhỏ vừa 5 phút cho mặt dưới phồng vàng.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Lật mặt chả chiên tiếp 3 phút đến khi hai mặt xém vàng ươm dậy mùi thơm khắp gian bếp.', timerMinutes: 3 },
      { stepNumber: 5, instruction: 'Bày chả nóng ra đĩa, chấm nước mắm chua ngọt pha đu đủ xanh và rau mùi.' }
    ]
  },
  {
    id: 'v5-bac-14',
    slug: 'oc-nau-chuoi-dau-bac-bo',
    title: 'Ốc nấu chuối xanh đậu phụ tía tô Bắc Bộ',
    description: 'Nồi om sánh vàng nghệ bùi béo với chuối tiêu xanh dẻo bở, ba chỉ ngậy, đậu phụ rán thấm vị mẻ mắm tôm và lá lốt tía tô thơm nồng.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('thit-kho-tau'),
    nutrition: { calories: 380, proteinG: 27, fatG: 19, carbG: 26 },
    tags: ['Miền Bắc', 'Món om', 'Chuối đậu', 'Dân dã'],
    ingredients: [
      { ingredientId: 'SNAIL', name: 'Thịt ốc bươu sơ chế sạch', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ thái con chì', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'TOFU', name: 'Đậu phụ cắt vuông rán vàng', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'GREEN_PAPAYA', name: 'Chuối xanh / Củ quả xanh cắt con chì', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã vắt nước', requiredQuantity: 25, unit: 'g' },
      { ingredientId: 'PERILLA', name: 'Tía tô & lá lốt thái sợi', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Gọt vỏ chuối xanh cắt con chì ngâm nước muối chanh khỏi thâm. Xào săn thịt ốc riêng với tỏi phi 2 phút rồi trút ra.', timerMinutes: 2 },
      { stepNumber: 2, instruction: 'Đảo cháy cạnh thịt ba chỉ trên nồi đáy dày, cho chuối xanh và nước nghệ vào xào ngấm mắm muối.' },
      { stepNumber: 3, instruction: 'Châm nước sôi xâm xấp cùng chút giấm mẻ, thả đậu phụ rán vào om nhỏ lửa 15 phút cho chuối bở dẻo sánh nước.', timerMinutes: 15 },
      { stepNumber: 4, instruction: 'Trút thịt ốc đã xào trở lại nồi đun sôi nhẹ 2 phút để ốc giữ trọn độ giòn sần sật.', tip: 'Cho ốc vào sau cùng giúp ốc không bị teo dai trong lúc ninh mềm chuối.', timerMinutes: 2 },
      { stepNumber: 5, instruction: 'Thả ngập tía tô và lá lốt thái chỉ vào đảo đều rồi tắt bếp, dùng nóng với bún rối.' }
    ]
  },
  {
    id: 'v5-bac-15',
    slug: 'ca-tram-kho-rieng-vu-dai',
    title: 'Cá trắm đen kho riềng gừng niêu đất Vũ Đại',
    description: 'Khúc cá trắm đen chắc nịch kho niêu đất với lớp riềng gừng giã lót đáy, nước hàng kẹo sánh đậm đà, thịt thơm bùi nhai cả xương mềm.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 60,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('ca-kho-to'),
    nutrition: { calories: 415, proteinG: 37, fatG: 21, carbG: 16 },
    tags: ['Miền Bắc', 'Cá kho Vũ Đại', 'Niêu đất', 'Cổ truyền'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá trắm đen cắt khúc dày', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ thái miếng dày', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'GALANGAL', name: 'Riềng củ thái lát & giã dập', requiredQuantity: 80, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng già đập dập', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'CARAMEL_SAUCE', name: 'Nước hàng thắng kẹo cánh gián', requiredQuantity: 25, unit: 'ml' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt cá cơm', requiredQuantity: 45, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rửa khúc cá trắm với nước chè xanh hoặc muối gừng cho ráo sạch, ướp với nước mắm, nước hàng và tiêu 20 phút.', timerMinutes: 20 },
      { stepNumber: 2, instruction: 'Trải kín lớp riềng lát và gừng dưới đáy niêu đất, xếp xen kẽ thịt ba chỉ và cá trắm lên trên.' },
      { stepNumber: 3, instruction: 'Rưới phần nước ướp và châm nước sôi ngập mặt cá, đun sôi bùng 5 phút rồi hạ lửa liu riu nhất.', tip: 'Vắt nửa quả chanh vào nồi cá kho giúp khử tanh hoàn toàn và thịt cá săn chắc bóng đẹp.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Kho âm ỉ mở hé vung trong 45 phút đến khi nước kho rút kẹo sánh óng màu nâu đỏ thấm đẫm thớ cá.', timerMinutes: 45 },
      { stepNumber: 5, instruction: 'Rắc tiêu đen giã dập lên mặt cá, dọn nguyên niêu đất nóng hổi ăn cùng cơm trắng dẻo.' }
    ]
  },
  {
    id: 'v5-bac-16',
    slug: 'banh-da-cua-dong-hai-phong',
    title: 'Bánh đa cua đồng Hải Phòng chả lá lốt',
    description: 'Sợi bánh đa đỏ dai mềm đặc sản Hải Phòng hòa cùng tảng gạch cua đồng béo ngậy, chả thịt lá lốt thơm nức và rau muống chần giòn.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 465, proteinG: 31, fatG: 16, carbG: 49 },
    tags: ['Miền Bắc', 'Hải Phòng', 'Bánh đa cua', 'Cua đồng'],
    ingredients: [
      { ingredientId: 'CRAB_MEAT', name: 'Cua đồng giã lọc nước & gạch cua', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bánh đa đỏ Hải Phòng ngâm mềm', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Thịt vai xay cuốn chả lá lốt', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'WATER_SPINACH', name: 'Rau muống ngọn non chần giòn', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'BETEL_LEAF', name: 'Lá lốt tươi bánh tẻ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'TOMATO', name: 'Cà chua bổ múi cau', requiredQuantity: 2, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp thịt xay với hành băm tiêu mắm, cuốn gọn trong lá lốt rồi áp chảo 6 phút cho chín thơm hai mặt.', timerMinutes: 6 },
      { stepNumber: 2, instruction: 'Đun nước lọc cua đồng với chút muối trên lửa vừa, vớt tảng thịt riêu cua ra bát riêng khi nước vừa sôi.' },
      { stepNumber: 3, instruction: 'Phi hành khô chưng gạch cua vàng thơm, xào cà chua rồi trút vào nồi nước dùng cua đun sôi nhẹ 5 phút.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Chần rau muống xanh giòn và bánh đa đỏ qua nước sôi trong 30 giây, xếp vào tô lớn.', tip: 'Chần bánh đa đỏ thật nhanh trong nước sôi già để sợi bánh mềm dẻo mà không bị nhũn.' },
      { stepNumber: 5, instruction: 'Bày tảng riêu cua, chả lá lốt lên mặt, chan nước dùng nóng rưới gạch cua chưng và hành phi giòn.' }
    ]
  },
  {
    id: 'v5-bac-17',
    slug: 'bap-bo-ngam-mam-bac-bo',
    title: 'Bắp bò hoa ngâm nước mắm tỏi ớt giòn ngọt',
    description: 'Lõi bắp bò hoa luộc quế hồi săn giòn những đường gân trong veo, ngâm thấm nước mắm đường tỏi ớt chua mặn ngọt hài hòa để dành ăn dần.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'bac',
    cookTimeMinutes: 50,
    servings: 6,
    difficulty: 'easy',
    imageUrl: DISH_IMG('thit-luoc-ca-phao'),
    nutrition: { calories: 295, proteinG: 36, fatG: 9, carbG: 16 },
    tags: ['Miền Bắc', 'Món ngâm', 'Bắp bò', 'Đãi khách'],
    ingredients: [
      { ingredientId: 'BEEF_SHANK', name: 'Bắp bò hoa nguyên thỏi tươi', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt thượng hạng', requiredQuantity: 120, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát hoặc đường phèn', requiredQuantity: 80, unit: 'g' },
      { ingredientId: 'RICE_VINEGAR', name: 'Giấm gạo thơm', requiredQuantity: 40, unit: 'ml' },
      { ingredientId: 'GARLIC', name: 'Tỏi ta bóc vỏ thái lát', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'GINGER', name: 'Gừng đập dập & hoa hồi luộc bò', requiredQuantity: 30, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Buộc gọn thỏi bắp bò bằng chỉ thực phẩm, luộc ngập nước cùng gừng và hoa hồi trên lửa nhỏ 35 phút cho chín mềm giòn.', timerMinutes: 35 },
      { stepNumber: 2, instruction: 'Vớt bắp bò ngâm ngay vào bát nước đá lạnh 15 phút cho thịt săn chắc rồi thấm thật khô ráo.', tip: 'Phải để cả thịt bò và nước mắm ngâm nguội hoàn toàn mới xếp vào hũ để nước mắm không bị nổi váng.', timerMinutes: 15 },
      { stepNumber: 3, instruction: 'Đun sôi 120ml nước mắm, 80g đường, 40ml giấm và 150ml nước lọc trong 3 phút, tắt bếp để nguội hẳn.', timerMinutes: 3 },
      { stepNumber: 4, instruction: 'Xếp bắp bò cùng tỏi lát, ớt tươi và tiêu hạt vào hũ thủy tinh sạch, rót ngập nước mắm ngâm qua đêm và thái lát mỏng khi dùng.' }
    ]
  },
  {
    id: 'v5-bac-18',
    slug: 'cha-la-lot-thit-bam-ha-noi',
    title: 'Chả thịt băm cuốn lá lốt rán thơm nức',
    description: 'Món mặn quốc dân của bữa cơm gia đình miền Bắc với nhân thịt vai dẻo ngọt quyện lá lốt thái chỉ bên trong, bọc lá lốt xanh rán thơm lừng.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'bac',
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('nem-ran-cha-gio'),
    nutrition: { calories: 340, proteinG: 23, fatG: 24, carbG: 6 },
    tags: ['Miền Bắc', 'Chả lá lốt', 'Dưới 20 phút', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai heo xay có dắt mỡ', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'BETEL_LEAF', name: 'Lá lốt tươi chọn lá to đều', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'SHALLOT', name: 'Hành khô băm nhỏ', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 20, unit: 'ml' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn áp chảo', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rửa sạch lá lốt thấm khô, giữ lại những lá to nguyên vẹn để gói, phần lá nhỏ đem thái chỉ mịn.' },
      { stepNumber: 2, instruction: 'Trộn đều thịt vai xay cùng lá lốt thái chỉ, hành khô, nước mắm và tiêu xay, ướp 10 phút.', tip: 'Đập thêm 1 lòng đỏ trứng gà giúp nhân thịt kết dính dẻo mọng không bị khô khi rán.', timerMinutes: 10 },
      { stepNumber: 3, instruction: 'Đặt mặt trái lá lốt ngửa lên, múc thìa nhân cuộn tròn gọn gàng, gài cuống lá cố định mép cuốn.' },
      { stepNumber: 4, instruction: 'Áp chảo các cuốn chả trên lửa vừa 8 phút, lật đều tay đến khi vỏ lá chuyển xanh sẫm bóng mượt dậy mùi thơm.', timerMinutes: 8 },
      { stepNumber: 5, instruction: 'Gắp chả ra đĩa nóng chấm nước mắm tỏi ớt chua ngọt ăn với cơm trắng.' }
    ]
  },
  {
    id: 'v5-bac-19',
    slug: 'canh-mang-suon-moc-ha-noi',
    title: 'Canh măng lưỡi lợn hầm sườn non mọc nấm',
    description: 'Bát canh măng cỗ truyền thống Hà Nội với măng hầm kỹ giòn mềm thấm vị ngọt xương sườn non, điểm những viên mọc nấm hương tròn trịa.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'bac',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('canh-bi-do-suon'),
    nutrition: { calories: 355, proteinG: 27, fatG: 20, carbG: 15 },
    tags: ['Miền Bắc', 'Canh măng', 'Cỗ Tết', 'Bổ dưỡng'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn non heo chặt khúc', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'BAMBOO_SHOOT', name: 'Măng củ / Măng khô đã ngâm luộc mềm', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Giò sống / Thịt xay viên mọc', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm hương & mộc nhĩ băm', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'SCALLION', name: 'Hành hoa chẻ củ & mùi tàu', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt ngon', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần sạch sườn non, phi thơm hành khô xào sườn săn rồi châm 1.2 lít nước hầm nhỏ lửa 20 phút.', timerMinutes: 20 },
      { stepNumber: 2, instruction: 'Xào riêng măng với chút mỡ hành và 15ml nước mắm trong 5 phút cho măng ngấm đậm gia vị trước khi hầm.', tip: 'Xào kỹ măng với mỡ hành trước khi trút vào nồi xương giúp miếng măng bóng bẩy không bị nhạt nhẽo.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Trút măng vào nồi nước sườn ninh tiếp 15 phút cho măng hút trọn vị ngọt tủy xương.', timerMinutes: 15 },
      { stepNumber: 4, instruction: 'Trộn thịt xay với mộc nhĩ nấm hương băm, vê viên tròn thả vào nồi đun 4 phút đến khi viên mọc nổi lên.', timerMinutes: 4 },
      { stepNumber: 5, instruction: 'Múc canh măng nóng ra bát chiết yêu, rải dọc hành hoa chần trắng nõn và tiêu Bắc lên trên.' }
    ]
  },
  {
    id: 'v5-bac-20',
    slug: 'canh-bong-tha-ha-thanh',
    title: 'Canh bóng thả súp lơ tôm khô thanh tao',
    description: 'Món canh thanh quý trên mâm cỗ Hà Thành xưa với nước dùng gà tôm khô ngọt trong, súp lơ xanh non, cà rốt tỉa hoa và mọc thịt mềm.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'bac',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('canh-bi-do-suon'),
    nutrition: { calories: 215, proteinG: 22, fatG: 8, carbG: 13 },
    tags: ['Miền Bắc', 'Hà Thành', 'Canh thanh', 'Đãi tiệc'],
    ingredients: [
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai quết dẻo viên mọc', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'DRIED_SHRIMP', name: 'Tôm khô loại ngon ngâm ấm', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'BROCCOLI', name: 'Súp lơ xanh tách nhánh nhỏ', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'CARROT', name: 'Cà rốt tỉa hoa năm cánh', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm hương ngâm nở khía mũ', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng tươi giã vắt nước khử mùi', requiredQuantity: 15, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Đun sôi 1 lít nước cùng tôm khô và chân nấm hương trong 12 phút trên lửa nhỏ để lấy nước dùng ngọt tự nhiên.', timerMinutes: 12 },
      { stepNumber: 2, instruction: 'Trộn thịt vai quết dẻo với chút tiêu sọ, nặn viên tròn nhỏ thả vào nồi nước dùng đun 4 phút cho chín nổi.', timerMinutes: 4 },
      { stepNumber: 3, instruction: 'Thả cà rốt tỉa hoa và mũ nấm hương vào đun 3 phút, sau đó cho súp lơ xanh vào chần chín tới giữ màu ngọc bích.', tip: 'Không đậy kín vung sau khi thả súp lơ xanh để bông cải giữ màu xanh tươi giòn ngọt.', timerMinutes: 3 },
      { stepNumber: 4, instruction: 'Nêm chút nước mắm cốt thật thanh, múc ra bát sứ trắng điểm cọng mùi ta tươi tắn.' }
    ]
  },
  {
    id: 'v5-bac-21',
    slug: 'su-hao-xao-muc-bac-bo',
    title: 'Su hào xào mực tươi cà rốt giòn ngọt',
    description: 'Đĩa xào cỗ quê miền Bắc giòn sần sật, thanh ngọt tự nhiên từ su hào non thái con chì quyện cùng mực ống khứa hoa trắng ngần.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'bac',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('bo-xao-can-toi'),
    nutrition: { calories: 210, proteinG: 24, fatG: 6, carbG: 14 },
    tags: ['Miền Bắc', 'Món xào', 'Dưới 20 phút', 'Hải sản'],
    ingredients: [
      { ingredientId: 'SQUID', name: 'Mực ống tươi khứa vảy thông', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'KOHLRABI', name: 'Su hào non gọt vỏ thái lượn sóng', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'CARROT', name: 'Cà rốt thái lát mỏng', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'GARLIC', name: 'Tỏi & gừng băm nhỏ', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'CILANTRO', name: 'Rau mùi & hành hoa cắt khúc', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon & dầu ăn', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần nhanh mực khứa vảy qua nước sôi gừng 20 giây cho săn trắng không ra nước khi xào.' },
      { stepNumber: 2, instruction: 'Phi thơm tỏi gừng trên chảo lửa lớn, đảo nhanh mực với 10ml nước mắm trong 1 phút rồi trút ra đĩa.', timerMinutes: 1 },
      { stepNumber: 3, instruction: 'Xào su hào và cà rốt trên lửa vừa lớn 4 phút cùng chút nước lọc cho rau củ chín trong giòn ngọt.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Trút mực trở lại chảo đảo đều 30 giây, thêm hành hoa rau mùi và tiêu xay rồi dọn nóng ngay.', tip: 'Xóc su hào với xíu muối trước khi xào giúp miếng su hào dẻo giòn và đậm vị hơn.' }
    ]
  },
  {
    id: 'v5-bac-22',
    slug: 'ngon-su-su-xao-toi-tam-dao',
    title: 'Ngọn su su Tam Đảo xào tỏi xanh mướt',
    description: 'Đặc sản rau núi cao miền Bắc xanh mướt mắt, tước sạch xơ xào lửa lớn bùng khói với tỏi ta đập dập giòn ngọt thanh khiết.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'bac',
    cookTimeMinutes: 12,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('rau-muong-xao'),
    nutrition: { calories: 135, proteinG: 5, fatG: 8, carbG: 11 },
    tags: ['Miền Bắc', 'Tam Đảo', 'Rau xào', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'WATER_SPINACH', name: 'Ngọn su su non tước sạch xơ', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'GARLIC', name: 'Tỏi ta bóc vỏ đập dập', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'OYSTER_SAUCE', name: 'Dầu hào đậm vị', requiredQuantity: 15, unit: 'ml' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn hoặc mỡ heo', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Bẻ từng đốt ngọn su su non từ ngọn xuống gốc, tước kỹ lớp vỏ xơ mỏng bên ngoài rồi vò nhẹ rửa sạch.', tip: 'Vò nhẹ phần lá ngọn su su dưới vòi nước giúp bỏ lông tơ và làm lá mềm mượt khi xào.' },
      { stepNumber: 2, instruction: 'Chần lướt ngọn su su trong nồi nước sôi có nhúm muối 45 giây rồi vớt ngay vào âu nước lạnh giữ màu xanh ngọc.', timerMinutes: 1 },
      { stepNumber: 3, instruction: 'Đun thật nóng chảo với dầu ăn, phi vàng thơm một nửa lượng tỏi đập dập.' },
      { stepNumber: 4, instruction: 'Trút rau ráo nước cùng dầu hào và nốt tỏi tươi vào đảo nhanh tay trên lửa cực lớn 2 phút rồi bày ra đĩa.', timerMinutes: 2 }
    ]
  },
  {
    id: 'v5-bac-23',
    slug: 'ga-doi-rang-gung-nghe-bac',
    title: 'Gà đồi rang gừng nghệ lá chanh săn chắc',
    description: 'Miếng gà đồi săn giòn rang khô ráo bóng vàng màu nghệ tươi, thơm cay ấm áp vị gừng già thái chỉ và lá chanh rắc cuối cùng.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('ga-kho-gung'),
    nutrition: { calories: 360, proteinG: 35, fatG: 19, carbG: 7 },
    tags: ['Miền Bắc', 'Gà rang gừng', 'Ấm bụng', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'CHICKEN_THIGH', name: 'Thịt gà ta chặt miếng vừa', requiredQuantity: 550, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng già thái sợi nhỏ', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã nhỏ', requiredQuantity: 15, unit: 'g' },
      { ingredientId: 'LIME_LEAF', name: 'Lá chanh bánh tẻ thái chỉ', requiredQuantity: 5, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt truyền thống', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp thịt gà chặt nhỏ với nước mắm, nghệ tươi giã, nửa lượng gừng sợi và tiêu xay trong 15 phút.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Cho gà vào chảo nóng đảo săn trên lửa vừa 6 phút để mỡ gà tự tiết ra mà không cần thêm nhiều dầu.', timerMinutes: 6 },
      { stepNumber: 3, instruction: 'Đậy vung om nhỏ lửa 10 phút cho thịt gà chín mềm bên trong, sau đó mở vung rang cạn cho da gà xém bóng.', tip: 'Rang khô không châm nhiều nước giúp miếng gà đồi săn giòn chuẩn kiểu Bắc Bộ.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Thả nốt phần gừng tươi thái chỉ và lá chanh vào đảo thơm 30 giây rồi tắt bếp dọn nóng.' }
    ]
  },
  {
    id: 'v5-bac-24',
    slug: 'vit-om-sau-khoai-so-ha-noi',
    title: 'Vịt om sấu khoai sọ rau ngổ Hà Nội',
    description: 'Thịt vịt béo mềm om sấu xanh chua thanh dịu nhẹ, khoai sọ bở tơi làm nước om sánh ngậy, dậy hương sả gừng và rau ngổ mùi tàu.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('ga-kho-gung'),
    nutrition: { calories: 445, proteinG: 31, fatG: 26, carbG: 22 },
    tags: ['Miền Bắc', 'Hà Nội', 'Vịt om sấu', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'DUCK_MEAT', name: 'Thịt vịt làm sạch chặt miếng', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'TARO', name: 'Khoai sọ gọt vỏ bổ đôi', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'TAMARIND', name: 'Quả sấu xanh cạo vỏ', requiredQuantity: 60, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả cây đập dập & băm nhỏ', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'COCONUT_WATER', name: 'Nước dừa tươi ngọt thanh', requiredQuantity: 400, unit: 'ml' },
      { ingredientId: 'SAW_HERB', name: 'Rau ngổ & mùi tàu thái rối', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chà xát kỹ da vịt với muối hạt và gừng giã để khử sạch mùi hôi, chặt miếng rồi ướp sả tỏi mắm 15 phút.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Áp chảo thịt vịt trên lửa vừa 6 phút cho ra bớt mỡ dưới da và bề mặt săn vàng.', timerMinutes: 6 },
      { stepNumber: 3, instruction: 'Đổ nước dừa tươi cùng sấu xanh vào nồi đun nhỏ lửa 15 phút, sau đó thả khoai sọ vào om tiếp 12 phút cho chín bở.', timerMinutes: 27 },
      { stepNumber: 4, instruction: 'Dầm nhẹ vài quả sấu trong nồi cho vị chua thanh quyện đều cùng độ bùi sánh của khoai sọ.', tip: 'Chiên sơ mặt ngoài củ khoai sọ trước khi thả vào om giúp khoai bở tơi mà không bị nát vữa.' },
      { stepNumber: 5, instruction: 'Rắc ngập mùi tàu và rau ngổ thái khúc, ăn nóng kèm bún tươi và rau muống chẻ.' }
    ]
  },
  {
    id: 'v5-bac-25',
    slug: 'chao-suon-sun-pho-co',
    title: 'Cháo sườn sụn bột gạo mịn phố cổ Hà Nội',
    description: 'Bát cháo bột gạo xay sánh mịn mượt như nhung khuấy trong nước hầm sườn sụn ngọt lịm, rắc ruốc bông, tiêu Bắc ăn chiều ấm lòng.',
    cuisine: 'vietnamese',
    category: 'mon_nhanh_sang',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('chao-ga-gung'),
    nutrition: { calories: 340, proteinG: 22, fatG: 12, carbG: 36 },
    tags: ['Miền Bắc', 'Cháo sườn', 'Phố cổ', 'Ấm bụng'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn sụn non chặt miếng nhỏ', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'RICE', name: 'Gạo tẻ ngâm mềm xay bột mịn', requiredQuantity: 180, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Thịt băm xào thơm rắc mặt', requiredQuantity: 100, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành khô phi vàng giòn', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon & tiêu xay', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần sạch sườn sụn rồi ninh với 1.4 lít nước trên lửa nhỏ 25 phút cho sườn mềm giòn ngọt nước.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Ngâm gạo tẻ nở mềm trong 30 phút rồi xay nhuyễn cùng nước lọc thành hỗn hợp bột gạo sánh mịn.' },
      { stepNumber: 3, instruction: 'Từ từ rót bột gạo vào nồi nước sườn đang ấm, khuấy đều tay liên tục theo một chiều trên lửa nhỏ 10 phút cho cháo chín sánh.', tip: 'Khuấy đều tay không nghỉ lúc cháo chớm sôi giúp mặt cháo bóng mượt không hề vón cục hay khê đáy.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Múc cháo nóng ra bát con, bày thịt băm xào, hành phi, rắc tiêu bột và ớt bột mịn thưởng thức.' }
    ]
  },
  {
    id: 'v5-bac-26',
    slug: 'bun-doc-mung-suon-moc-ha-noi',
    title: 'Bún dọc mùng sườn mọc nghệ vàng Hà Nội',
    description: 'Tô bún sáng chuẩn Hà Nội với dọc mùng tước vỏ bóp giòn sần sật hút đẫm nước dùng sườn cà chua thanh ngọt, điểm sườn non và mọc nấm.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'bac',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 435, proteinG: 29, fatG: 14, carbG: 48 },
    tags: ['Miền Bắc', 'Hà Nội', 'Bún dọc mùng', 'Ăn sáng'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn non heo chặt miếng', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Giò sống trộn nấm hương làm mọc', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún tươi sợi nhỏ', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'CELERY', name: 'Dọc mùng tước vỏ bóp muối sạch', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín đỏ', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã tạo sắc vàng', requiredQuantity: 15, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Tước sạch vỏ dọc mùng, thái vát rồi bóp muối 15 phút, xả nước vắt khô và chần sơ nước sôi để hết ngứa hoàn toàn.', tip: 'Đeo găng tay khi sơ chế và vắt thật kiệt nước để miếng dọc mùng hút trọn nước dùng ngọt khi ăn.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Ướp sườn non với nước nghệ vàng và mắm, xào săn rồi hầm với 1.3 lít nước trong 20 phút.', timerMinutes: 20 },
      { stepNumber: 3, instruction: 'Xào cà chua bổ múi cau trút vào nồi nước sườn, thả từng viên mọc nấm hương đun sôi 4 phút.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Xếp bún, sườn vàng, viên mọc và dọc mùng xanh mướt vào tô, chan ngập nước dùng nóng rắc hành mùi tàu.' }
    ]
  },
  {
    id: 'v5-bac-27',
    slug: 'nom-su-hao-tai-heo-bac-bo',
    title: 'Nộm su hào cà rốt tai heo kinh giới giòn mát',
    description: 'Món chống ngấy kinh điển trên mâm cỗ Bắc Bộ với sợi su hào cà rốt giòn tan, tai heo thái mỏng sần sật và rau kinh giới thơm mát.',
    cuisine: 'vietnamese',
    category: 'mon_cuon_nom',
    region: 'bac',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('goi-cuon-tom-thit'),
    nutrition: { calories: 245, proteinG: 19, fatG: 11, carbG: 18 },
    tags: ['Miền Bắc', 'Món nộm', 'Chống ngấy', 'Giòn mát'],
    ingredients: [
      { ingredientId: 'PORK_EAR', name: 'Tai heo làm sạch luộc giòn', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'KOHLRABI', name: 'Su hào bánh tẻ thái sợi chỉ', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'CARROT', name: 'Cà rốt bào sợi', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'LIME', name: 'Chanh tươi vắt nước cốt', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'VIETNAMESE_BALM', name: 'Rau kinh giới & rau mùi', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm & đường pha nộm', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Luộc chín tai heo cùng gừng và giấm trong 15 phút, vớt ngâm ngay nước đá lạnh rồi thái sợi thật mỏng.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Xóc su hào và cà rốt thái sợi với xíu muối 10 phút, vắt ráo kiệt nước để sợi nộm giòn tanh tách.', tip: 'Vắt khô nước rau củ trước khi trộn giúp đĩa nộm ráo rượi không bị chảy nước lõng bõng.', timerMinutes: 10 },
      { stepNumber: 3, instruction: 'Khuấy tan nước cốt chanh, đường, nước mắm ngon cùng tỏi ớt băm nhuyễn.' },
      { stepNumber: 4, instruction: 'Trộn đều su hào, cà rốt, tai heo với nước trộn nộm và rau kinh giới thái rối, bày ra đĩa thưởng thức.' }
    ]
  },
  {
    id: 'v5-bac-28',
    slug: 'tom-dong-rang-ba-chi-bac-bo',
    title: 'Tôm đồng rang thịt ba chỉ lá chanh Bắc Bộ',
    description: 'Tôm đồng tươi nhảy tanh tách rang cháy cạnh cùng thịt ba chỉ xém vàng béo ngậy, mặn ngọt bóng mướt thơm nức lá chanh thái chỉ.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'bac',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('tom-rim-mam'),
    nutrition: { calories: 355, proteinG: 27, fatG: 23, carbG: 9 },
    tags: ['Miền Bắc', 'Món rang', 'Đưa cơm', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm đồng tươi cắt râu rửa sạch', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ thái con chì mỏng', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành khô băm nhỏ', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'LIME_LEAF', name: 'Lá chanh non & hành hoa', requiredQuantity: 5, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 25, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát thắng màu', requiredQuantity: 12, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cho thịt ba chỉ vào chảo nóng đảo đều 5 phút đến khi thịt ra bớt mỡ và xém vàng các cạnh.', timerMinutes: 5 },
      { stepNumber: 2, instruction: 'Phi thơm hành khô ngay trong mỡ ba chỉ, trút tôm đồng vào đảo lửa lớn cho vỏ tôm chuyển đỏ au giòn rụm.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Nêm đường và nước mắm quanh thành chảo, hạ lửa vừa rang thêm 4 phút cho mắm đường keo bóng bám đều tôm thịt.', tip: 'Rưới nước mắm sát thành chảo nóng giúp mắm dậy hương thơm nồng đặc trưng món rang Bắc.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Rắc hành hoa và lá chanh thái chỉ thật mảnh, đảo nhẹ rồi tắt bếp dọn cùng cơm nóng.' }
    ]
  },
  {
    id: 'v5-bac-29',
    slug: 'dau-phu-kho-tuong-ban-chay',
    title: 'Đậu phụ kho tương Bần nấm hương chay Bắc Bộ',
    description: 'Món chay dân dã đồng bằng sông Hồng với đậu phụ rán thấm vị tương nếp Bần ngọt hậu bùi béo cùng nấm hương và gừng sợi ấm áp.',
    cuisine: 'vietnamese',
    category: 'mon_chay',
    region: 'bac',
    cookTimeMinutes: 20,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('dau-phu-sot-ca'),
    nutrition: { calories: 220, proteinG: 17, fatG: 10, carbG: 15 },
    tags: ['Miền Bắc', 'Món chay', 'Tương Bần', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'TOFU', name: 'Đậu phụ trắng cắt miếng rán vàng', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm hương khô ngâm nở', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'SOY_SAUCE', name: 'Tương Bần nếp bùi / Nước tương đậm', requiredQuantity: 40, unit: 'ml' },
      { ingredientId: 'GINGER', name: 'Gừng tươi thái chỉ', requiredQuantity: 15, unit: 'g' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu thực vật', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rán vàng các mặt đậu phụ cho dai vỏ. Giữ lại nước ngâm nấm hương đã lắng sạch cặn.' },
      { stepNumber: 2, instruction: 'Phi thơm gừng sợi với chút dầu ăn, cho nấm hương vào xào dậy mùi thơm ngậy trong 2 phút.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Xếp đậu phụ vào nồi, rưới tương nếp và nước ngâm nấm xâm xấp mặt đậu, kho lửa nhỏ 12 phút.', tip: 'Dùng chính nước ngâm nấm hương giúp nước kho tương ngọt tự nhiên mà không cần bột ngọt.', timerMinutes: 12 },
      { stepNumber: 4, instruction: 'Khi nước tương sánh lại bám đều bìa đậu thì rắc tiêu đen đập dập và dọn nóng.' }
    ]
  },
  {
    id: 'v5-bac-30',
    slug: 'canh-cai-cuc-thit-bam-bac-bo',
    title: 'Canh cải cúc nấu thịt băm gừng ấm bụng',
    description: 'Bát canh mùa đông dịu ngọt của người miền Bắc với rau cải cúc non mềm thơm mát chỉ chần chín tới trong nước thịt thăn băm ngọt thanh.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'bac',
    cookTimeMinutes: 15,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-chua-ca'),
    nutrition: { calories: 175, proteinG: 17, fatG: 7, carbG: 9 },
    tags: ['Miền Bắc', 'Canh cải cúc', 'Dưới 20 phút', 'Ấm bụng'],
    ingredients: [
      { ingredientId: 'CHRYSANTHEMUM_GREENS', name: 'Rau cải cúc non nhặt sạch cắt đôi', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'GROUND_PORK', name: 'Thịt thăn heo băm nhỏ', requiredQuantity: 180, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng tươi đập dập thái sợi', requiredQuantity: 15, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành khô băm', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt ngon', requiredQuantity: 15, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Nhặt ngọn cải cúc non rửa nhẹ tay để không dập lá, vẩy thật ráo nước.' },
      { stepNumber: 2, instruction: 'Ướp thịt băm với hành khô và chút nước mắm, cho vào nồi đảo săn rồi đổ 900ml nước đun sôi 5 phút, hớt sạch bọt.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Thả gừng sợi và cải cúc vào nồi nước đang sôi bùng, dìm nhẹ rau xuống đun đúng 45 giây rồi tắt bếp ngay.', tip: 'Cải cúc cực nhanh chín, tắt bếp ngay khi nước sôi lại để rau giữ mùi thơm tinh dầu và không bị nồng.', timerMinutes: 1 },
      { stepNumber: 4, instruction: 'Múc canh cải cúc xanh mướt ra tô lớn, dùng nóng trong bữa cơm chiều.' }
    ]
  },

  // ===========================================================================
  // MIỀN TRUNG (28 MASTERPIECES: v5-trung-01 .. v5-trung-28)
  // ===========================================================================
  {
    id: 'v5-trung-01',
    slug: 'bun-bo-hue-gio-heo-co-do',
    title: 'Bún bò Huế giò heo sả ruốc cố đô',
    description: 'Tô bún bò Huế chuẩn vị cố đô với nước dùng xương hầm sả cây ngọt thanh quyện mắm ruốc Huế thơm nồng, bắp bò hoa và khoanh giò heo béo giòn.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'trung',
    cookTimeMinutes: 50,
    servings: 4,
    difficulty: 'hard',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 545, proteinG: 37, fatG: 22, carbG: 50 },
    tags: ['Miền Trung', 'Xứ Huế', 'Bún bò Huế', 'Tinh hoa'],
    ingredients: [
      { ingredientId: 'BEEF_SHANK', name: 'Bắp bò hoa & nạm bò tươi', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'PORK_HOCK', name: 'Chân giò heo chặt khoanh tròn', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún sợi to tròn xứ Huế', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả cây đập dập & sả băm nhuyễn', requiredQuantity: 5, unit: 'piece' },
      { ingredientId: 'SHRIMP_PASTE', name: 'Mắm ruốc Huế chính gốc', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'CHILI', name: 'Ớt sừng & dầu màu điều chưng sả', requiredQuantity: 2, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần sạch giò heo và bắp bò qua nước sôi gừng, sau đó hầm cùng 4 cây sả đập dập trong 35 phút cho mềm giòn.', timerMinutes: 35 },
      { stepNumber: 2, instruction: 'Hòa tan mắm ruốc Huế với 150ml nước lạnh, chờ lắng sạch cát rồi gạn lấy phần nước trong trút vào nồi nước dùng.', tip: 'Chỉ gạn phần nước ruốc trong giúp nước lèo dậy hương cố đô mà vẫn trong trẻo thanh thoát.' },
      { stepNumber: 3, instruction: 'Phi thơm sả băm và ớt băm trong dầu màu điều tạo lớp sa tế đỏ cam óng ánh nổi nhẹ trên mặt nồi.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Thái mỏng bắp bò đã nguội, chần nóng bún sợi to xếp vào tô lớn cùng khoanh giò heo.' },
      { stepNumber: 5, instruction: 'Chan ngập nước lèo sả ruốc sôi sục, rắc hành tây thái mỏng, rau răm và ăn kèm bắp chuối bào.' }
    ]
  },
  {
    id: 'v5-trung-02',
    slug: 'mi-quang-tom-thit-xu-quang',
    title: 'Mì Quảng tôm thịt trứng cút bánh đa vừng',
    description: 'Đặc sản trứ danh đất Quảng với sợi mì gạo nghệ vàng óng, chan xâm xấp nước nhưn tôm thịt ba chỉ rim củ nén thơm lừng và bánh tráng mè nướng giòn.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'trung',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 515, proteinG: 33, fatG: 20, carbG: 52 },
    tags: ['Miền Trung', 'Quảng Nam', 'Mì Quảng', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'NOODLE', name: 'Mì Quảng sợi dẹt vàng nghệ', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm đất hoặc tôm thẻ tươi', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ thái lát vừa', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'QUAIL_EGG', name: 'Trứng cút luộc bóc vỏ', requiredQuantity: 8, unit: 'piece' },
      { ingredientId: 'SHALLOT', name: 'Củ nén / Hành tím giã dập', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu phụng nguyên chất & màu điều', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp tôm và thịt ba chỉ với nước mắm, bột nghệ, tiêu xay và một nửa củ nén giã dập trong 15 phút.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Khử dầu phụng nóng già với củ nén thơm nức, trút thịt ba chỉ vào xào săn rồi thêm tôm đảo đỏ au.', tip: 'Phi củ nén trong dầu phụng tạo nên mùi thơm đặc trưng không thể trộn lẫn của mì xứ Quảng.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Châm 500ml nước hầm xương và thả trứng cút vào rim lửa nhỏ 12 phút để tạo phần nước nhưn sánh đậm.', timerMinutes: 12 },
      { stepNumber: 4, instruction: 'Lót rau sống chín vị dưới đáy tô, trải sợi mì Quảng lên trên và xếp tôm, thịt, trứng cút đều đặn.' },
      { stepNumber: 5, instruction: 'Chan nước nhưn chỉ vừa xâm xấp đáy tô, rắc đậu phộng rang, bẻ bánh tráng mè nướng giòn và cắn kèm ớt xanh.' }
    ]
  },
  {
    id: 'v5-trung-03',
    slug: 'cao-lau-hoi-an-thit-xiu',
    title: 'Cao lầu Hội An thịt xá xíu rau Trà Quế',
    description: 'Món mì cổ phố Hội với sợi cao lầu vàng dai sần sật, thịt đùi heo khìa ngũ vị thái lát mỏng mọng nước, tóp mỡ da giòn và rau thơm Trà Quế.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'trung',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 505, proteinG: 31, fatG: 18, carbG: 55 },
    tags: ['Miền Trung', 'Hội An', 'Cao lầu', 'Phố cổ'],
    ingredients: [
      { ingredientId: 'PORK_LOIN', name: 'Thịt nạc dăm heo nguyên thỏi làm xíu', requiredQuantity: 450, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Sợi mì Cao lầu Hội An tươi', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'SOY_SAUCE', name: 'Nước tương đậm & ngũ vị hương', requiredQuantity: 40, unit: 'ml' },
      { ingredientId: 'BEAN_SPROUTS', name: 'Giá đỗ chần sơ', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'MINT_HERB', name: 'Rau sống Trà Quế (húng lủi, cải con)', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'GARLIC', name: 'Tỏi băm & đường rim xíu', requiredQuantity: 2, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp thỏi thịt nạc dăm với nước tương, tỏi băm, đường và chút ngũ vị hương trong 25 phút cho thấm đều.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Áp chảo vàng các mặt thỏi thịt, sau đó đổ nước ướp cùng 250ml nước lọc vào rim nhỏ lửa 20 phút thành nước sốt xíu sánh nâu.', timerMinutes: 20 },
      { stepNumber: 3, instruction: 'Vớt thịt xíu để hơi nguội rồi thái lát mỏng bản to; chần nhanh giá đỗ và sợi mì cao lầu qua nước sôi.', tip: 'Trộn sợi mì cao lầu với 1 thìa mỡ tỏi phi ngay sau khi chần giúp sợi mì bóng mướt dai giòn.' },
      { stepNumber: 4, instruction: 'Xếp rau thơm Trà Quế tươi dưới đáy tô, đặt giá chần, sợi cao lầu và xòe đều các lát thịt xíu lên mặt.' },
      { stepNumber: 5, instruction: 'Rưới 3 muỗng nước sốt khìa thịt xíu đậm đà, rắc da heo chiên giòn và vắt lát chanh tươi trộn đều.' }
    ]
  },
  {
    id: 'v5-trung-04',
    slug: 'ca-bong-song-tra-kho-tieu',
    title: 'Cá bống sông Trà kho tiêu quánh kẹo Quảng Ngãi',
    description: 'Những con cá bống cát nhỏ xinh săn cứng cong mình trong tộ đất, áo lớp mắm đường óng ánh cánh gián cay nồng tiêu sọ và ớt hiểm đỏ.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'trung',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('ca-kho-to'),
    nutrition: { calories: 310, proteinG: 33, fatG: 10, carbG: 20 },
    tags: ['Miền Trung', 'Quảng Ngãi', 'Cá bống kho', 'Đưa cơm'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá bống cát tươi nguyên con nhỏ', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ miền Trung', requiredQuantity: 45, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát vàng xứ Quảng', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'BLACK_PEPPER', name: 'Tiêu sọ hạt & tiêu xay', requiredQuantity: 8, unit: 'g' },
      { ingredientId: 'CHILI', name: 'Ớt hiểm nguyên trái', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu phụng hoặc mỡ heo', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Xóc cá bống với chút muối hạt trong rổ tre cho sạch nhớt, rửa nhanh để ráo rồi ướp đường trước 15 phút cho thân cá săn cứng.', tip: 'Ướp đường trước rồi mới cho nước mắm là bí quyết giúp con cá bống kho xong cong giòn không hề gãy nát.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Thêm nước mắm nhĩ, dầu phụng, tiêu sọ và ớt hiểm vào tộ cá, ướp tiếp 10 phút.', timerMinutes: 10 },
      { stepNumber: 3, instruction: 'Bắc tộ đất lên bếp lửa thật nhỏ không châm nước lã, nghiêng nhẹ tay cầm tộ thay vì dùng đũa đảo.', timerMinutes: 20 },
      { stepNumber: 4, instruction: 'Kho rim chậm đến khi nước mắm đường keo quánh óng ánh bám chặt từng con cá, rắc thêm tiêu xay dùng với cơm trắng nóng.' }
    ]
  },
  {
    id: 'v5-trung-05',
    slug: 'ca-nuc-hap-cuon-banh-trang',
    title: 'Cá nục hấp hành gừng cuốn bánh tráng rau sống',
    description: 'Cá nục chuối tươi xanh hấp chín ngọt lịm cùng hành hoa gừng sợi, gỡ thịt cuốn bánh tráng rau muống non chấm mắm nêm tỏi ớt đậm tình miền biển.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'trung',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('ga-hap-la-chanh'),
    nutrition: { calories: 350, proteinG: 34, fatG: 11, carbG: 28 },
    tags: ['Miền Trung', 'Đà Nẵng', 'Cá nục hấp', 'Thanh lành'],
    ingredients: [
      { ingredientId: 'MACKEREL', name: 'Cá nục tươi mắt trong làm sạch', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng mỏng cuốn nem', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'SCALLION', name: 'Hành lá chẻ dài & củ hành tím', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'GINGER', name: 'Gừng tươi thái sợi', requiredQuantity: 25, unit: 'g' },
      { ingredientId: 'LETTUCE', name: 'Rau sống, dưa leo & rau muống non', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ dầm ớt tỏi chanh', requiredQuantity: 40, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Làm sạch ruột cá nục, khía nhẹ hai đường bên hông cá rồi ướp xíu muối, tiêu và đầu hành đập dập 10 phút.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Xếp cá vào đĩa sâu lòng phủ đầy gừng sợi và hành tím thái lát, đặt vào xửng nước đang sôi hấp 12 phút.', tip: 'Đặt xửng cá vào khi nước đã sôi mạnh giúp khóa ngay vị ngọt biển trong thớ cá nục.', timerMinutes: 12 },
      { stepNumber: 3, instruction: 'Trải ngập dọc hành lá xanh lên mặt cá, đậy nắp hấp thêm 1 phút cho hành vừa chín tái thơm ngát.', timerMinutes: 1 },
      { stepNumber: 4, instruction: 'Giã nhuyễn tỏi ớt đường pha cùng nước mắm nhĩ và cốt chanh, gỡ thịt cá nóng cuốn bánh tráng rau sống chấm đẫm.' }
    ]
  },
  {
    id: 'v5-trung-06',
    slug: 'thit-heo-ngam-nuoc-mam-nhi',
    title: 'Thịt heo ba chỉ ngâm nước mắm nhĩ trong veo',
    description: 'Miếng ba chỉ rút sườn miền Trung luộc chín tới rồi ngâm mắm đường nấu kỹ, phần mỡ chuyển trong giòn sần sật không hề ngấy béo.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'trung',
    cookTimeMinutes: 45,
    servings: 6,
    difficulty: 'easy',
    imageUrl: DISH_IMG('thit-luoc-ca-phao'),
    nutrition: { calories: 410, proteinG: 23, fatG: 31, carbG: 11 },
    tags: ['Miền Trung', 'Cỗ Tết', 'Thịt ngâm mắm', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ liền khối tươi ngon', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ cá cơm nguyên chất', requiredQuantity: 150, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát trắng hoặc đường phèn', requiredQuantity: 120, unit: 'g' },
      { ingredientId: 'GARLIC', name: 'Tỏi Lý Sơn bóc vỏ', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'CHILI', name: 'Ớt hiểm đỏ tươi', requiredQuantity: 4, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cắt ba chỉ thành dải dài 4cm, buộc chỉ gọn rồi luộc ngập nước với chút hành gừng trong 22 phút cho vừa chín tới.', timerMinutes: 22 },
      { stepNumber: 2, instruction: 'Vớt thịt rửa ngay qua nước đun sôi để nguội pha đá cho bì giòn trắng, sau đó thấm khô hoàn toàn bề mặt.' },
      { stepNumber: 3, instruction: 'Nấu sôi hỗn hợp 150ml nước mắm nhĩ và 120g đường trên lửa nhỏ 5 phút cho sánh nhẹ, hớt sạch bọt rồi để thật nguội.', tip: 'Tỉ lệ mắm đường đậm đặc kiểu miền Trung giúp mỡ heo kết tinh trong veo và bảo quản thơm ngon suốt tuần.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Xếp thịt kèm tỏi Lý Sơn, ớt hiểm vào hũ sạch, rót ngập nước mắm đường nguội, thái lát mỏng ăn kèm dưa món và cơm nóng.' }
    ]
  },
  {
    id: 'v5-trung-07',
    slug: 'ga-nuong-sa-la-chanh-mien-trung',
    title: 'Gà ta nướng sả ớt lá chanh vàng óng',
    description: 'Đùi và cánh gà thả đồi ướp đẫm sả giã, ớt xiêm, mật ong rừng nướng xém da giòn rụm, tỏa hương lá chanh thơm lừng chấm muối ớt xanh.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'trung',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-cha-ha-noi'),
    nutrition: { calories: 425, proteinG: 37, fatG: 24, carbG: 13 },
    tags: ['Miền Trung', 'Tây Nguyên', 'Gà nướng', 'Món tiệc'],
    ingredients: [
      { ingredientId: 'CHICKEN_THIGH', name: 'Đùi và má đùi gà ta khía nhẹ', requiredQuantity: 700, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả tươi băm thật nhuyễn', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'LIME_LEAF', name: 'Lá chanh tươi giã & thái sợi', requiredQuantity: 8, unit: 'g' },
      { ingredientId: 'HONEY', name: 'Mật ong rừng nguyên chất', requiredQuantity: 25, unit: 'ml' },
      { ingredientId: 'CHILI', name: 'Ớt xiêm xanh & ớt đỏ', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rửa sạch gà với muối chanh, khía vài đường trên phần thịt dày rồi ướp sả băm, nước mắm, ớt và nửa lượng mật ong 25 phút.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Xếp gà lên vỉ nướng than hồng hoặc lò 190°C nướng mặt trong trước 12 phút cho thịt chín mọng.', timerMinutes: 12 },
      { stepNumber: 3, instruction: 'Lật mặt da lên trên, phết hỗn hợp mật ong pha chút dầu ăn nướng tiếp 10 phút đến khi da gà vàng bóng giòn rụm.', tip: 'Phết mật ong ở nửa cuối thời gian nướng giúp da gà lên màu hổ phách óng ả mà không bị cháy đắng.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Chặt miếng vừa ăn rắc lá chanh thái chỉ, chấm muối ớt xanh giã nhuyễn vắt chanh tươi.' }
    ]
  },
  {
    id: 'v5-trung-08',
    slug: 'ram-tom-dat-binh-dinh',
    title: 'Ram tôm đất Bình Định giòn tan cuốn cải xanh',
    description: 'Những cuốn ram nhỏ bằng ngón tay gói trọn con tôm đất đỏ gạch nguyên đuôi và ba chỉ thái hạt lựu, chiên phồng giòn rụm cuốn lá cải cay.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'trung',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('nem-ran-cha-gio'),
    nutrition: { calories: 375, proteinG: 25, fatG: 20, carbG: 24 },
    tags: ['Miền Trung', 'Bình Định', 'Ram tôm đất', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm đất tươi nhỏ lột vỏ chừa đuôi', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ thái chỉ nhỏ', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng phơi sương cuốn ram', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'SHALLOT', name: 'Hành hương chẻ tư dọc củ', requiredQuantity: 5, unit: 'piece' },
      { ingredientId: 'MUSTARD_GREENS', name: 'Rau cải bẹ xanh non ăn cuốn', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu phụng chiên ram', requiredQuantity: 80, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp riêng tôm đất và ba chỉ thái nhỏ với xíu muối tiêu trong 10 phút để giữ nguyên vị ngọt tươi không ra nước.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Cắt bánh tráng thành miếng tam giác nhỏ, đặt 1 con tôm chừa đuôi ra ngoài, 1 sợi ba chỉ và 1 tép hành hương rồi cuốn chặt tay.' },
      { stepNumber: 3, instruction: 'Thả ram vào chảo dầu nóng vừa chiên lửa nhỏ vừa 8 phút đến khi vỏ bánh phồng rộp vàng giòn đều.', tip: 'Không ướp nhân với nước mắm lỏng giúp cuốn ram Bình Định giữ độ giòn rụm suốt nhiều giờ sau khi chiên.', timerMinutes: 8 },
      { stepNumber: 4, instruction: 'Cuốn từng chiếc ram nóng hổi trong lá cải bẹ xanh the mát cùng dưa leo, chấm nước mắm tỏi ớt đậu phộng.' }
    ]
  },
  {
    id: 'v5-trung-09',
    slug: 'hen-xao-xuc-banh-da-hue',
    title: 'Hến xào sả ớt rau răm xúc bánh đa Huế',
    description: 'Thịt hến sông Hương ngọt lịm xào săn thơm nức sả ớt, miến giòn và rau răm thái nhỏ, bẻ miếng bánh đa vừng giòn rụm xúc ăn cực cuốn.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'trung',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-ngao-chua'),
    nutrition: { calories: 280, proteinG: 24, fatG: 11, carbG: 21 },
    tags: ['Miền Trung', 'Xứ Huế', 'Hến xào', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'CLAM', name: 'Thịt hến tươi đãi sạch cát', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả băm nhuyễn', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'ONION', name: 'Hành tây thái hạt lựu nhỏ', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'VIETNAMESE_CORIANDER', name: 'Rau răm & hành lá thái nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh đa vừng đen nướng giòn', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'CHILI', name: 'Ớt sừng băm & nước mắm ruốc nhẹ', requiredQuantity: 2, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Đãi lại thịt hến qua rây trong âu nước sạch để loại bỏ hết vỏ vụn, vẩy thật ráo nước trên rổ mắt nhỏ.' },
      { stepNumber: 2, instruction: 'Phi vàng thơm sả băm, tỏi và ớt trên chảo thật nóng cùng 15ml dầu ăn.' },
      { stepNumber: 3, instruction: 'Trút hến và hành tây hạt lựu vào đảo lửa lớn 3 phút, nêm chút nước mắm ngon cho hến săn khô ráo.', tip: 'Xào hến trên lửa lớn thật nhanh để thịt hến căng mẩy ngọt đậm và không tiết nước ra đĩa.', timerMinutes: 3 },
      { stepNumber: 4, instruction: 'Đảo đều rau răm thái nhỏ rồi tắt bếp ngay, múc ra đĩa rắc mè rang ăn kèm bánh đa nướng giòn.' }
    ]
  },
  {
    id: 'v5-trung-10',
    slug: 'com-hen-con-hen-xu-hue',
    title: 'Cơm hến Cồn Hến dọc mùng mắm ruốc Huế',
    description: 'Bát cơm nguội tơi dẻo trộn mười hai thức ăn kèm từ hến xào đậm vị, rau sống thái mảnh, tóp mỡ giòn, lạc rang và bát nước hến gừng nóng bỏng.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'trung',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('canh-ngao-chua'),
    nutrition: { calories: 420, proteinG: 24, fatG: 14, carbG: 50 },
    tags: ['Miền Trung', 'Xứ Huế', 'Cơm hến', 'Dân gian'],
    ingredients: [
      { ingredientId: 'CLAM', name: 'Thịt hến tươi & nước luộc hến', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'RICE', name: 'Cơm trắng nấu ráo để nguội tơi', requiredQuantity: 450, unit: 'g' },
      { ingredientId: 'BANANA_BLOSSOM', name: 'Bắp chuối bào & dọc mùng thái chỉ', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'SHRIMP_PASTE', name: 'Mắm ruốc Huế pha tỏi ớt chanh', requiredQuantity: 25, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng tươi đập dập nấu nước hến', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'VIETNAMESE_CORIANDER', name: 'Rau răm, bạc hà & khế chua', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Đun sôi lại nước luộc hến trong đục màu sữa cùng nhánh gừng đập dập và xíu mắm ruốc lọc trong 5 phút, giữ thật nóng.', timerMinutes: 5 },
      { stepNumber: 2, instruction: 'Phi hành tỏi ớt chưng dầu, xào săn thịt hến trên lửa lớn 2 phút cho thấm vị cay thơm.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Thái thật mảnh bắp chuối, rau thơm, dọc mùng bóp ráo rồi xếp lớp đáy tô, xới cơm nguội tơi lên trên.', tip: 'Cơm hến đúng điệu phải dùng cơm để nguội tơi hạt để khi chan nước hến nóng rau vẫn giòn mà cơm không nhão.' },
      { stepNumber: 4, instruction: 'Bày thịt hến xào, rưới sốt mắm ruốc ớt chưng lên mặt, dọn kèm chén nước luộc hến nóng hổi riêng bên cạnh.' }
    ]
  },
  {
    id: 'v5-trung-11',
    slug: 'com-ga-tam-ky-quang-nam',
    title: 'Cơm gà Tam Kỳ xé phay nghệ vàng hành răm',
    description: 'Hạt cơm nấu bằng nước luộc gà và nghệ tươi vàng ươm bóng dẻo, bày đẫm gà tơ xé phay trộn hành tây rau răm chua ngọt chuẩn vị Quảng Nam.',
    cuisine: 'vietnamese',
    category: 'mon_nhanh_sang',
    region: 'trung',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('com-tam-suon'),
    nutrition: { calories: 510, proteinG: 34, fatG: 16, carbG: 57 },
    tags: ['Miền Trung', 'Tam Kỳ', 'Cơm gà', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'CHICKEN_THIGH', name: 'Thịt gà tơ thả vườn tươi', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'RICE', name: 'Gạo tẻ dẻo thơm vo sạch', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã lấy nước cốt', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'ONION', name: 'Hành tây thái mỏng ngâm đá', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'VIETNAMESE_CORIANDER', name: 'Rau răm & húng trà quế', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'LIME', name: 'Chanh tươi, tỏi & nước mắm trộn', requiredQuantity: 2, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Luộc gà tơ với củ hành tím và lát nghệ trong 22 phút cho da vàng ươm, vớt ra để nguội rồi xé miếng vừa ăn.', timerMinutes: 22 },
      { stepNumber: 2, instruction: 'Phi thơm tỏi băm với chút mỡ gà, cho gạo ráo nước và nước nghệ vào rang 3 phút rồi nấu chín bằng chính nước luộc gà.', tip: 'Rang sơ hạt gạo với mỡ tỏi trước khi nấu giúp hạt cơm vàng bóng tơi dẻo không hề dính bết.', timerMinutes: 18 },
      { stepNumber: 3, instruction: 'Bóp nhẹ thịt gà xé cùng hành tây ngâm giấm đường, rau răm, nước cốt chanh, muối tiêu cho thấm thanh.' },
      { stepNumber: 4, instruction: 'Đơm cơm vàng ra đĩa, trải gà xé phay lên trên, ăn kèm chén canh nước luộc gà lá giang và mắm tỏi ớt sánh.' }
    ]
  },
  {
    id: 'v5-trung-12',
    slug: 'bun-cha-ca-quy-nhon-binh-dinh',
    title: 'Bún chả cá Quy Nhơn nước dùng thanh ngọt',
    description: 'Đặc sản biển Bình Định với miếng chả cá thu chiên dai ngọt tự nhiên, nước dùng nấu xương cá cùng dứa cà chua trong veo không chút dầu mỡ.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'trung',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 430, proteinG: 32, fatG: 11, carbG: 51 },
    tags: ['Miền Trung', 'Quy Nhơn', 'Bún chả cá', 'Thanh đạm'],
    ingredients: [
      { ingredientId: 'FISH_CAKE', name: 'Chả cá thu chiên & chả cá hấp Bình Định', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún tươi sợi nhỏ', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'PINEAPPLE', name: 'Thơm chín cắt lát rẻ quạt', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín bổ múi cau', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành lá, ngò rí & hành tây', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ Quy Nhơn', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Thái lát vát chéo miếng chả cá chiên và chả cá hấp dày khoảng 0.5cm cho đẹp mắt.' },
      { stepNumber: 2, instruction: 'Phi thơm đầu hành trắng, xào sơ thơm và cà chua cho ra màu cam đỏ tự nhiên rồi châm 1.3 lít nước đun sôi 15 phút.', timerMinutes: 15 },
      { stepNumber: 3, instruction: 'Nêm nước mắm nhĩ và chút đường phèn cho vị thanh tao, thả nhẹ vài lát chả cá vào nồi đun 2 phút cho nóng mềm.', tip: 'Đường phèn tạo vị ngọt thanh mát chuẩn miền biển mà không làm gắt cổ họng.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Chần bún xếp ra tô, bày đầy chả cá hai loại, chan nước dùng nóng rắc hành ngò và ăn kèm tương ớt xào Bình Định.' }
    ]
  },
  {
    id: 'v5-trung-13',
    slug: 'banh-canh-ca-loc-xu-hue',
    title: 'Bánh canh cá lóc bột gạo xứ Huế đậm đà',
    description: 'Sợi bánh canh bột gạo xắt tay trắng đục mềm mướt trong nồi nước lèo xương cá lóc đồng trong ngọt, cá um nghệ hành nén vàng thơm cay nồng.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'trung',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('pho-bo-ha-noi'),
    nutrition: { calories: 445, proteinG: 31, fatG: 11, carbG: 54 },
    tags: ['Miền Trung', 'Xứ Huế', 'Bánh canh', 'Ấm bụng'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá lóc đồng tươi luộc gỡ thịt', requiredQuantity: 550, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Sợi bánh canh bột gạo tươi', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Củ nén / Hành tím đập dập', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã nhỏ', requiredQuantity: 15, unit: 'g' },
      { ingredientId: 'SCALLION', name: 'Hành lá thái nhỏ & tiêu xay', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt ngon', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Luộc chín cá lóc với gừng đập dập trong 10 phút, vớt ra gỡ lấy từng thớ thịt trắng chắc, giã xương lọc lại lấy nước ngọt.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Phi thơm củ nén và nghệ tươi với chút dầu màu điều, cho thịt cá lóc vào đảo nhẹ tay cùng nước mắm và tiêu 3 phút cho thấm vàng.', tip: 'Đảo cá bằng việc lắc nhẹ chảo giúp thớ thịt cá lóc nguyên miếng săn thơm không bị vụn.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Đun sôi nồi nước dùng cá, thả sợi bánh canh bột gạo vào nấu 4 phút cho nước hơi sánh nhẹ tự nhiên.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Múc bánh canh nóng ra tô, xúc thịt cá lóc um nén lên mặt, rắc thật nhiều hành lá tiêu đen và ớt chưng.' }
    ]
  },
  {
    id: 'v5-trung-14',
    slug: 'thit-luoc-cuon-banh-trang-da-nang',
    title: 'Thịt heo hai đầu da cuốn bánh tráng Đà Nẵng',
    description: 'Lát thịt heo luộc khéo giữ hai đầu mỡ da trong mướt kẹp nạc hồng ở giữa, cuốn bánh tráng lề cùng rau rừng dưa giá chấm mắm nêm dứa thơm lừng.',
    cuisine: 'vietnamese',
    category: 'mon_cuon_nom',
    region: 'trung',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('goi-cuon-tom-thit'),
    nutrition: { calories: 410, proteinG: 26, fatG: 21, carbG: 29 },
    tags: ['Miền Trung', 'Đà Nẵng', 'Bánh tráng cuốn', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'PORK_BELLY', name: 'Thịt mông hoặc ba chỉ rút sườn', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng Đại Lộc dẻo dai', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'PINEAPPLE', name: 'Thơm chín băm nhuyễn pha mắm', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'CUCUMBER', name: 'Dưa leo & chuối chát thái lát dài', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'LETTUCE', name: 'Rau sống chín vị (xà lách, tía tô, húng)', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'FERMENTED_ANCHOVY_SAUCE', name: 'Mắm nêm cá cơm nguyên chất', requiredQuantity: 60, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cuộn buộc khối thịt rồi luộc ngập nước với củ hành tím và nhúm muối trên lửa vừa 25 phút cho thịt chín mềm mọng.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Ngâm thịt vừa chín qua nước mát 5 phút để da giòn, sau đó thái lát mỏng dài đẹp mắt.' },
      { stepNumber: 3, instruction: 'Pha mắm nêm chuẩn Đà Nẵng: trộn 60ml mắm nêm với thơm băm nhuyễn, đường, tỏi ớt giã và cốt chanh dậy mùi nồng nàn.', tip: 'Thơm chín băm nhuyễn làm dịu vị mặn gắt của mắm nêm và tạo độ sánh quyện hấp dẫn.' },
      { stepNumber: 4, instruction: 'Trải bánh tráng, xếp rau sống, dưa leo, lát thịt heo rồi cuộn chặt tay chấm đẫm chén mắm nêm thơm cay.' }
    ]
  },
  {
    id: 'v5-trung-15',
    slug: 'ca-thu-kho-thom-mien-trung',
    title: 'Cá thu tươi kho thơm cà chua miền biển Trung',
    description: 'Khứa cá thu phấn dày thịt chiên săn vàng, kho thấm trong sốt thơm chín và cà chua chua ngọt hài hòa, thịt cá bùi ngọt không chút xương dăm.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'trung',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('ca-kho-to'),
    nutrition: { calories: 365, proteinG: 32, fatG: 18, carbG: 17 },
    tags: ['Miền Trung', 'Cá thu kho', 'Hải sản', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'MACKEREL', name: 'Cá thu tươi cắt khứa dày 2cm', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'PINEAPPLE', name: 'Thơm chín gọt mắt cắt miếng tam giác', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín thái hạt lựu', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'SHALLOT', name: 'Hành tím & tỏi băm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ ngon', requiredQuantity: 35, unit: 'ml' },
      { ingredientId: 'SCALLION', name: 'Hành lá & ớt hiểm', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Thấm khô mặt khứa cá thu, áp chảo lửa vừa 5 phút cho hai mặt cá vàng sém săn chắc.', timerMinutes: 5 },
      { stepNumber: 2, instruction: 'Phi thơm hành tỏi, xào cà chua và thơm cùng chút đường 4 phút cho tiết nước sốt đỏ cam sánh mịn.', timerMinutes: 4 },
      { stepNumber: 3, instruction: 'Xếp khứa cá thu vào nồi sốt, nêm nước mắm nhĩ và 120ml nước sôi, kho nhỏ lửa 15 phút đồng thời rưới sốt đều lên mặt cá.', tip: 'Enzyme tự nhiên trong trái thơm giúp thớ cá thu mềm mọng thấm vị mặn ngọt vào tận lõi.', timerMinutes: 15 },
      { stepNumber: 4, instruction: 'Rắc tiêu đen xay và đầu hành chẻ lên trên, dọn nóng cùng cơm trắng dẻo.' }
    ]
  },
  {
    id: 'v5-trung-16',
    slug: 'muc-com-hap-gung-nha-trang',
    title: 'Mực cơm hấp gừng sả chấm mắm gừng Nha Trang',
    description: 'Những con mực ống trứng tươi rói căng tròn miền biển Khánh Hòa hấp cách thủy sả gừng giữ trọn vị ngọt giòn tự nhiên của đại dương.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'trung',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('ga-hap-la-chanh'),
    nutrition: { calories: 225, proteinG: 31, fatG: 4, carbG: 12 },
    tags: ['Miền Trung', 'Nha Trang', 'Mực hấp', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SQUID', name: 'Mực cơm hoặc mực lá tươi nguyên con', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng tươi thái sợi & giã nhuyễn', requiredQuantity: 35, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả cây đập dập lót xửng', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành lá & cần tây cắt khúc', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'LIME', name: 'Chanh tươi & ớt pha mắm gừng', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ Nha Trang', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rửa nhẹ mực cơm tươi qua nước muối loãng, rút túi mực khéo léo để giữ nguyên phần da tím hồng và trứng mực.' },
      { stepNumber: 2, instruction: 'Lót sả đập dập dưới xửng khi nước đã sôi mạnh, xếp mực cùng gừng thái sợi lên hấp lửa lớn đúng 6 phút.', tip: 'Hấp mực lửa lớn thời gian ngắn giúp mực giòn sần sật ngọt lịm, hấp quá lâu mực sẽ teo và dai.', timerMinutes: 6 },
      { stepNumber: 3, instruction: 'Thả hành lá chẻ lên mặt mực hấp thêm 30 giây rồi nhấc xửng ra ngay.' },
      { stepNumber: 4, instruction: 'Giã nhuyễn gừng tỏi ớt đường pha cùng nước mắm nhĩ và cốt chanh, chấm ngập từng khoanh mực nóng hổi.' }
    ]
  },
  {
    id: 'v5-trung-17',
    slug: 'canh-chua-ca-bop-mang-chua',
    title: 'Canh chua cá biển nấu măng chua rau ngổ',
    description: 'Nồi canh chua thanh tao kiểu duyên hải miền Trung với cá biển tươi béo không tanh, măng chua giòn sần sật, cà chua và thơm chín ngọt mát.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'trung',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-chua-ca'),
    nutrition: { calories: 265, proteinG: 28, fatG: 8, carbG: 18 },
    tags: ['Miền Trung', 'Canh chua', 'Măng chua', 'Hải sản'],
    ingredients: [
      { ingredientId: 'MACKEREL', name: 'Cá bớp / Cá thu cắt khúc tươi', requiredQuantity: 450, unit: 'g' },
      { ingredientId: 'BAMBOO_SHOOT', name: 'Măng chua rửa sạch vắt ráo', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín bổ múi cau', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'PINEAPPLE', name: 'Thơm chín thái lát', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'RICE_PADDY_HERB', name: 'Rau ngổ (ngò ôm) & ngò gai', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm cốt & ớt sừng', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp khúc cá với chút muối, tiêu và đầu hành băm trong 10 phút cho thịt cá săn đậm.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Phi thơm hành tỏi, xào măng chua, thơm và cà chua trong 4 phút rồi châm 1.1 lít nước sôi.', timerMinutes: 4 },
      { stepNumber: 3, instruction: 'Khi nước sôi già, thả cá vào nấu lửa vừa 8 phút đồng thời hớt bọt kỹ cho nước canh trong vắt.', tip: 'Chỉ thả cá vào khi nước canh đang sôi bùng để cá không hề bị tanh.', timerMinutes: 8 },
      { stepNumber: 4, instruction: 'Nêm nước mắm cốt vừa miệng, rắc rau ngổ ngò gai thái nhỏ và vài lát ớt tươi dùng nóng.' }
    ]
  },
  {
    id: 'v5-trung-18',
    slug: 'lau-ga-la-e-ot-xiem-xanh',
    title: 'Lẩu gà lá é măng tươi ớt xiêm xanh Phú Yên',
    description: 'Đặc sản xứ Nẫu vang danh với nước dùng gà trong ngọt thanh the mát tinh dầu lá é trắng, cay dịu ớt xiêm xanh giã dập và măng củ giòn ngọt.',
    cuisine: 'vietnamese',
    category: 'mon_lau_tiec',
    region: 'trung',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bo-kho-banh-mi'),
    nutrition: { calories: 430, proteinG: 36, fatG: 18, carbG: 28 },
    tags: ['Miền Trung', 'Phú Yên', 'Lẩu gà lá é', 'Ấm áp'],
    ingredients: [
      { ingredientId: 'CHICKEN_THIGH', name: 'Gà ta chặt miếng vừa ăn', requiredQuantity: 700, unit: 'g' },
      { ingredientId: 'THAI_BASIL', name: 'Lá é tươi / Húng quế trắng nhặt ngọn', requiredQuantity: 3, unit: 'bunch' },
      { ingredientId: 'BAMBOO_SHOOT', name: 'Măng tươi luộc kỹ thái con chì', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm bào ngư trắng sạch', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'CHILI', name: 'Ớt xiêm xanh giã dập', requiredQuantity: 5, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon & sả cây', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Giã một nắm nhỏ lá é cùng ớt xiêm xanh, tỏi và tiêu, ướp vào thịt gà chặt miếng trong 15 phút cho thấm vị.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Phi thơm sả đập dập trên nồi lớn, trút gà đã ướp vào xào săn 5 phút cho dậy mùi thơm the cay.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Đổ 1.5 lít nước sôi và măng tươi vào ninh lửa vừa 18 phút đến khi gà mềm vừa tới và nước ngọt thanh.', timerMinutes: 18 },
      { stepNumber: 4, instruction: 'Thả nấm bào ngư vào đun sôi 2 phút, khi ăn mới nhúng từng đợt lá é tươi lướt nhanh để lá giữ vị bùi the mát.', tip: 'Nhúng lá é vừa chín tái rồi vớt ngay giúp cảm nhận trọn vị the thanh như sả chanh mà không bị đắng.', timerMinutes: 2 }
    ]
  },
  {
    id: 'v5-trung-19',
    slug: 'goi-hai-san-hanh-tay-mien-trung',
    title: 'Gỏi mực tôm hành tây rau răm miền biển',
    description: 'Đĩa gỏi khai vị giòn sần sật của vùng biển miền Trung với mực lá khứa hoa, tôm sú chần ngọt lịm trộn hành tây giòn tan và nước mắm chanh tỏi.',
    cuisine: 'vietnamese',
    category: 'mon_cuon_nom',
    region: 'trung',
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('goi-cuon-tom-thit'),
    nutrition: { calories: 255, proteinG: 29, fatG: 6, carbG: 20 },
    tags: ['Miền Trung', 'Món gỏi', 'Hải sản', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SQUID', name: 'Mực lá tươi dày mình khứa hoa', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi bóc vỏ chẻ lưng', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'ONION', name: 'Hành tây thái mỏng ngâm đá lạnh', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'CARROT', name: 'Cà rốt & dưa leo thái sợi', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'LIME', name: 'Chanh tươi vắt lấy cốt', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ, đường & rau răm', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần nhanh tôm và mực trong nước sôi có đập gừng sả khoảng 2 phút, vớt thả ngay vào tô nước đá lạnh cho giòn căng.', timerMinutes: 2 },
      { stepNumber: 2, instruction: 'Vớt hành tây đã ngâm nước đá giấm ra vắt thật ráo để hết hăng mà vẫn giòn ngọt.' },
      { stepNumber: 3, instruction: 'Giã tỏi ớt đường pha cùng 30ml nước mắm nhĩ và cốt chanh thành sốt trộn gỏi sánh kẹo.' },
      { stepNumber: 4, instruction: 'Trộn đều tôm, mực, hành tây, cà rốt và rau răm với nước sốt ngay trước khi dọn kèm bánh phồng tôm.', tip: 'Rưới nước sốt trộn hai đợt giúp hải sản thấm đậm vị mà rau củ vẫn giữ độ giòn ráo.' }
    ]
  },
  {
    id: 'v5-trung-20',
    slug: 'bo-nuong-la-lot-xu-hue',
    title: 'Bò nướng lá lốt sả thơm cuốn bánh tráng Huế',
    description: 'Thịt bò băm mỡ gáy ướp sả ngũ vị cuộn lá lốt nướng than xèo xèo dậy mùi khói, cuốn khế chua chuối chát chấm mắm nêm cay nồng.',
    cuisine: 'vietnamese',
    category: 'mon_cuon_nom',
    region: 'trung',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-cha-ha-noi'),
    nutrition: { calories: 385, proteinG: 29, fatG: 21, carbG: 19 },
    tags: ['Miền Trung', 'Xứ Huế', 'Bò lá lốt', 'Món nướng'],
    ingredients: [
      { ingredientId: 'GROUND_BEEF', name: 'Thịt bò mềm xay nhuyễn', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Mỡ heo băm nhỏ giúp bò mềm mọng', requiredQuantity: 80, unit: 'g' },
      { ingredientId: 'BETEL_LEAF', name: 'Lá lốt tươi chọn lá bánh tẻ', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'LEMONGRASS', name: 'Sả & tỏi băm thật mịn', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng mỏng & bún ăn kèm', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'OYSTER_SAUCE', name: 'Dầu hào, mật ong & tiêu xay', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Nhào kỹ thịt bò xay cùng mỡ heo hạt lựu, sả tỏi băm, dầu hào, chút mật ong và tiêu trong 15 phút.', tip: 'Pha chút mỡ heo vào thịt bò nạc là bí quyết giúp cuốn bò nướng mềm mọng nước không bị khô bã.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Cuốn thịt thành thỏi nhỏ gọn trong lá lốt, xiên vào que tre và phết lớp dầu ăn mỏng bên ngoài lá.' },
      { stepNumber: 3, instruction: 'Nướng trên than hồng hoặc nồi chiên 195°C trong 10 phút, trở mặt cho lá lốt xém bóng thơm nức.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Rút xiên bò nóng rắc mỡ hành đậu phộng, cuốn cùng bánh tráng rau thơm dưa leo thưởng thức.' }
    ]
  },
  {
    id: 'v5-trung-21',
    slug: 'tom-su-rim-mam-toi-quang-ngai',
    title: 'Tôm sú rim mắm tỏi Lý Sơn cay ngọt',
    description: 'Tôm sú biển chắc nịch cắt râu xẻ lưng, rim kẹo trong mắm nhĩ đường vàng cùng tỏi cô đơn Lý Sơn phi thơm giòn rụm.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'trung',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('tom-rim-mam'),
    nutrition: { calories: 270, proteinG: 30, fatG: 9, carbG: 15 },
    tags: ['Miền Trung', 'Lý Sơn', 'Tôm rim', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi xẻ nhẹ sống lưng', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'GARLIC', name: 'Tỏi Lý Sơn băm & đập dập', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ cốt', requiredQuantity: 30, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường vàng', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'CHILI', name: 'Ớt sừng băm cay', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn hoặc bơ lạt', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rửa sạch tôm sú, dùng kéo cắt dọc vỏ lưng rút chỉ đen giúp gia vị thấm thẳng vào thịt tôm.' },
      { stepNumber: 2, instruction: 'Áp chảo tôm trên lửa lớn 3 phút cho vỏ tôm chuyển màu đỏ cam giòn thơm.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Gạt tôm sang cạnh chảo, phi vàng tỏi Lý Sơn và ớt băm rồi rưới nước mắm đường vào đảo đều lửa vừa 5 phút.', tip: 'Xẻ dọc sống lưng tôm giúp sốt mắm tỏi thấm đẫm bên trong mà vỏ ngoài vẫn giòn bóng.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Rắc tiêu đen và hành lá thái nhỏ khi sốt vừa kẹo sánh, dùng ngay với cơm nóng.' }
    ]
  },
  {
    id: 'v5-trung-22',
    slug: 'canh-hen-nau-chua-rau-ram',
    title: 'Canh hến nấu khế chua cà chua rau răm',
    description: 'Bát canh giải nhiệt thanh đạm bên dòng sông Hương với vị ngọt lịm của nước hến quyện cà chua chua dịu và hương rau răm the ấm.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'trung',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-ngao-chua'),
    nutrition: { calories: 155, proteinG: 18, fatG: 5, carbG: 10 },
    tags: ['Miền Trung', 'Xứ Huế', 'Canh hến', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'CLAM', name: 'Thịt hến & 1 lít nước luộc hến trong', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'TOMATO', name: 'Cà chua chín bổ múi cau', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'PINEAPPLE', name: 'Khế chua hoặc thơm thái lát mỏng', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'VIETNAMESE_CORIANDER', name: 'Rau răm & hành lá thái nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'SHALLOT', name: 'Hành tím phi thơm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 15, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Gạn kỹ nước luộc hến qua rây mịn để bỏ hết cặn đáy nồi, giữ lấy phần nước ngọt trắng ngà.' },
      { stepNumber: 2, instruction: 'Phi thơm hành tím, xào nhanh thịt hến với chút nước mắm 1 phút rồi múc riêng ra bát.', timerMinutes: 1 },
      { stepNumber: 3, instruction: 'Xào cà chua và lát chua trong nồi cho lên màu đẹp, đổ nước luộc hến vào đun sôi 5 phút.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Trút thịt hến xào và rau răm hành lá vào nồi vừa sôi bùng lại là tắt bếp ngay.', tip: 'Cho thịt hến vào cuối cùng giúp hến căng tròn mềm ngọt không bị quắt nhỏ.' }
    ]
  },
  {
    id: 'v5-trung-23',
    slug: 'suon-kho-sa-ot-nghe-xu-quang',
    title: 'Sườn non kho sả ớt nghệ tươi đậm đà xứ Quảng',
    description: 'Món mặn hao cơm ngày mưa miền Trung với từng dẻ sườn non thấm màu nghệ vàng rực, cay thơm sả băm ớt hiểm kho sệt bóng.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'trung',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('suon-xao-chua-ngot'),
    nutrition: { calories: 410, proteinG: 28, fatG: 26, carbG: 14 },
    tags: ['Miền Trung', 'Sườn kho', 'Cay thơm', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn non heo chặt khúc 3cm', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả tươi băm mịn', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'TURMERIC', name: 'Nghệ tươi giã nhỏ', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'CHILI', name: 'Ớt sừng & ớt hiểm băm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ & đường vàng', requiredQuantity: 35, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần sơ sườn non qua nước sôi muối rửa sạch, ướp với nghệ tươi, nửa lượng sả băm, nước mắm và đường 15 phút.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Phi thơm nốt phần sả ớt băm trên nồi nóng, trút sườn vào đảo săn 5 phút cho vàng ươm dậy mùi.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Châm 150ml nước sôi xâm xấp, đậy nắp kho lửa nhỏ 15 phút đến khi thịt sườn mềm róc xương và nước sốt keo sệt.', tip: 'Dùng nghệ tươi giã thay bột nghệ giúp miếng sườn có màu vàng hổ phách tươi sáng và thơm dịu.', timerMinutes: 15 },
      { stepNumber: 4, instruction: 'Rắc tiêu đen xay, dọn nóng cùng cơm trắng và dưa leo mát.' }
    ]
  },
  {
    id: 'v5-trung-24',
    slug: 'goi-tom-thit-me-rang-xu-hue',
    title: 'Vả trộn tôm thịt ba chỉ mè rang cung đình Huế',
    description: 'Món trộn thanh nhã đất thần kinh với lát quả bùi dẻo không chát, quyện tôm sú bóc vỏ, ba chỉ thái sợi, rau răm và mè trắng rang thơm.',
    cuisine: 'vietnamese',
    category: 'mon_cuon_nom',
    region: 'trung',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('goi-cuon-tom-thit'),
    nutrition: { calories: 315, proteinG: 26, fatG: 14, carbG: 21 },
    tags: ['Miền Trung', 'Cung đình Huế', 'Món trộn', 'Thanh nhã'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm tươi luộc chín bóc vỏ', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ luộc thái con chì nhỏ', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'GREEN_PAPAYA', name: 'Trái vả Huế hoặc củ quả luộc thái mỏng', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'VIETNAMESE_CORIANDER', name: 'Rau răm thái nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'SHALLOT', name: 'Hành tím phi thơm trong dầu', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon & mè trắng rang', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Luộc mềm trái vả trong 12 phút, cạo vỏ rồi thái lát mỏng ngang thớ, vắt nhẹ cho ráo bớt nước.', timerMinutes: 12 },
      { stepNumber: 2, instruction: 'Phi vàng hành tím với dầu ăn, cho tôm luộc và thịt ba chỉ vào đảo nhanh cùng nước mắm và tiêu 2 phút cho thấm.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Trộn nhẹ các lát vả bùi mềm với tôm thịt vừa xào ấm, rau răm và mè trắng rang thơm lừng.', tip: 'Trộn lúc tôm thịt còn hơi ấm giúp lát vả hút trọn dầu hành thơm béo mà không cần pha giấm chua.' },
      { stepNumber: 4, instruction: 'Bày ra đĩa sâu lòng, bẻ bánh tráng mè đen nướng giòn xúc ăn thanh tao.' }
    ]
  },
  {
    id: 'v5-trung-25',
    slug: 'chao-hai-san-tom-muc-lang-co',
    title: 'Cháo hải sản tôm mực nấm rơm Lăng Cô',
    description: 'Nồi cháo loãng ngọt lịm kiểu đầm phá Lăng Cô với hạt gạo nở hoa quyện vị ngọt tươi của tôm biển, mực ống và nấm rơm búp tròn.',
    cuisine: 'vietnamese',
    category: 'mon_nhanh_sang',
    region: 'trung',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('chao-ga-gung'),
    nutrition: { calories: 325, proteinG: 27, fatG: 7, carbG: 38 },
    tags: ['Miền Trung', 'Lăng Cô', 'Cháo hải sản', 'Bổ dưỡng'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm biển tươi lột vỏ giữ đầu nấu nước', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'SQUID', name: 'Mực ống tươi cắt khoanh', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'RICE', name: 'Gạo tẻ rang sơ vàng nhẹ', requiredQuantity: 160, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm rơm búp chẻ đôi', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'GINGER', name: 'Gừng thái sợi & hành ngò', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ & tiêu đen', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Xào thơm vỏ đầu tôm rồi châm 1.5 lít nước đun 10 phút, lọc lấy nước dùng ngọt đỏ cam nấu nhừ gạo rang trong 18 phút.', timerMinutes: 28 },
      { stepNumber: 2, instruction: 'Phi hành tím xào săn tôm, mực và nấm rơm trên lửa lớn 2 phút với chút nước mắm nhĩ.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Khi hạt cháo vừa bung nở nhưng nước vẫn trong không đặc quánh, trút hải sản xào và gừng sợi vào đun sôi bùng 2 phút.', tip: 'Cháo hải sản miền Trung nấu hơi loãng từ gạo rang giúp nước cháo trong ngọt thanh không bị vữa.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Múc cháo nóng ra tô, rắc hành ngò, hành phi và thật nhiều tiêu sọ đập dập.' }
    ]
  },
  {
    id: 'v5-trung-26',
    slug: 'dau-khuon-kho-sa-ot-chay-hue',
    title: 'Đậu khuôn kho sả ớt nấm rơm chay xứ Huế',
    description: 'Món chay tịnh truyền thống chùa Huế với đậu khuôn chiên dai thấm đẫm sả băm nghệ vàng, nấm rơm ngọt giòn và nước tương đậm vị.',
    cuisine: 'vietnamese',
    category: 'mon_chay',
    region: 'trung',
    cookTimeMinutes: 20,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('dau-phu-sot-ca'),
    nutrition: { calories: 230, proteinG: 17, fatG: 11, carbG: 16 },
    tags: ['Miền Trung', 'Chay Huế', 'Đậu khuôn', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'TOFU', name: 'Đậu khuôn trắng chiên vàng săn', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm rơm tươi rửa muối cắt đôi', requiredQuantity: 180, unit: 'g' },
      { ingredientId: 'LEMONGRASS', name: 'Sả tươi băm mịn', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'CHILI', name: 'Ớt sừng băm', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'SOY_SAUCE', name: 'Nước tương đậm & dầu hào chay', requiredQuantity: 35, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cắt đậu khuôn chiên thành miếng con chì vừa gắp; phi vàng thơm sả băm và ớt trên chảo dầu thực vật.' },
      { stepNumber: 2, instruction: 'Cho nấm rơm vào xào săn lửa lớn 2 phút rồi trút đậu khuôn vào đảo đều.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Rưới 35ml nước tương pha chút đường và 80ml nước lọc, rim lửa nhỏ 10 phút cho nước kho rút sánh thấm sâu.', tip: 'Phi sả ở lửa vừa đến khi vừa ngả vàng giúp món kho chay dậy hương nồng ấm mà không đắng.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Rắc tiêu đen và ngò rí lên trên, dùng nóng với cơm trắng thanh tịnh.' }
    ]
  },
  {
    id: 'v5-trung-27',
    slug: 'nam-xao-la-lot-chay-hoi-an',
    title: 'Nấm đùi gà xé xào lá lốt mè rang chay Hội An',
    description: 'Thân nấm đùi gà hấp chín xé sợi dai ngọt như thịt gà, xào sả nghệ cùng lá lốt thái chỉ và mè rang thơm bùi xúc bánh tráng nướng.',
    cuisine: 'vietnamese',
    category: 'mon_chay',
    region: 'trung',
    cookTimeMinutes: 18,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('dau-phu-sot-ca'),
    nutrition: { calories: 195, proteinG: 10, fatG: 9, carbG: 19 },
    tags: ['Miền Trung', 'Hội An', 'Món chay', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'MUSHROOM', name: 'Nấm đùi gà tươi chọn cây chắc', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'BETEL_LEAF', name: 'Lá lốt tươi thái sợi bản to', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'LEMONGRASS', name: 'Sả & boa-rô băm nhỏ', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'SOY_SAUCE', name: 'Nước tương & hạt nêm nấm chay', requiredQuantity: 20, unit: 'ml' },
      { ingredientId: 'SESAME_OIL', name: 'Dầu mè thơm & mè trắng rang', requiredQuantity: 15, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Hấp nguyên cây nấm đùi gà 7 phút cho chín ngọt, để bớt nóng rồi dùng tay xé dọc thành sợi dai giòn.', timerMinutes: 7 },
      { stepNumber: 2, instruction: 'Phi thơm sả và boa-rô băm trên chảo nóng, trút sợi nấm vào xào lửa lớn 4 phút cùng nước tương cho săn ráo.', timerMinutes: 4 },
      { stepNumber: 3, instruction: 'Thả lá lốt thái sợi và rưới dầu mè vào đảo nhanh 30 giây cho dậy hương nồng ấm.', tip: 'Hấp nấm nguyên cây rồi xé sợi giúp nấm giữ được độ dai giòn sần sật thay vì ra nước khi cắt dao.' },
      { stepNumber: 4, instruction: 'Rắc đẫm mè trắng rang lên mặt, ăn kèm cơm nóng hoặc xúc bánh đa vừng.' }
    ]
  },
  {
    id: 'v5-trung-28',
    slug: 'canh-bi-do-tom-tuoi-mien-trung',
    title: 'Canh bí đỏ dẻo bùi nấu tôm đất ngò ôm',
    description: 'Món canh gia đình mộc mạc miền Trung với miếng bí đỏ hồ lô dẻo sáp ngọt bùi nấu cùng tôm đất giã dập và ngò ôm thơm thanh mát.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'trung',
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-bi-do-suon'),
    nutrition: { calories: 205, proteinG: 20, fatG: 5, carbG: 21 },
    tags: ['Miền Trung', 'Canh bí đỏ', 'Dưới 20 phút', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'PUMPKIN', name: 'Bí đỏ dẻo gọt vỏ cắt miếng vừa', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'SHRIMP', name: 'Tôm đất tươi lột vỏ đập dập', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'RICE_PADDY_HERB', name: 'Rau ngò ôm (rau ngổ) cắt nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'SHALLOT', name: 'Hành tím đập dập', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm nhĩ & dầu phụng', requiredQuantity: 15, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Đập dập nhẹ thịt tôm đất cùng đầu hành tím và chút tiêu xay để tôm tiết hết vị ngọt vào nước canh.' },
      { stepNumber: 2, instruction: 'Phi thơm hành tím với xíu dầu phụng, xào săn tôm 1 phút rồi đổ 900ml nước sôi vào nồi.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Thả bí đỏ vào nấu lửa vừa 10 phút đến khi miếng bí chín mềm dẻo bùi, nêm nước mắm vừa ăn.', tip: 'Ngò ôm cắt nhỏ là gia vị bí truyền hợp vị nhất với canh bí đỏ, làm dậy mùi thơm thanh dịu.', timerMinutes: 10 },
      { stepNumber: 4, instruction: 'Rắc ngò ôm xanh mướt lên mặt nồi rồi tắt bếp, múc nóng ra tô thưởng thức.' }
    ]
  },

  // ===========================================================================
  // MIỀN NAM (27 MASTERPIECES: v5-nam-01 .. v5-nam-27)
  // ===========================================================================
  {
    id: 'v5-nam-01',
    slug: 'com-tam-suon-bi-cha-sai-gon',
    title: 'Cơm tấm sườn nướng bì chả mỡ hành Sài Gòn',
    description: 'Đĩa cơm tấm trứ danh Sài Thành với miếng sườn cốt lết ướp mật ong sả tỏi nướng than xém cạnh, chả trứng chưng mộc nhĩ, mỡ hành và nước mắm kẹo.',
    cuisine: 'vietnamese',
    category: 'mon_nhanh_sang',
    region: 'nam',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('com-tam-suon'),
    nutrition: { calories: 615, proteinG: 38, fatG: 25, carbG: 62 },
    tags: ['Miền Nam', 'Sài Gòn', 'Cơm tấm', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn cốt lết heo có viền mỡ', requiredQuantity: 550, unit: 'g' },
      { ingredientId: 'RICE', name: 'Gạo tấm thơm nấu tơi dẻo', requiredQuantity: 450, unit: 'g' },
      { ingredientId: 'CHICKEN_EGG', name: 'Trứng gà & thịt xay làm chả chưng', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'LEMONGRASS', name: 'Sả & tỏi vắt lấy nước cốt ướp', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành lá thái nhỏ làm mỡ hành', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm Phú Quốc & mật ong', requiredQuantity: 50, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Dùng sống dao dần nhẹ hai mặt miếng sườn cốt lết cho đứt thớ gân, ướp nước cốt sả tỏi, 20ml nước mắm và mật ong 30 phút.', tip: 'Dần mềm thớ thịt và thêm 1 thìa sữa đặc hoặc mật ong giúp miếng sườn nướng mềm mọng bóng đẹp chuẩn tiệm.', timerMinutes: 30 },
      { stepNumber: 2, instruction: 'Hấp chín chả trứng mộc nhĩ trong 15 phút rồi quết lòng đỏ trứng lên mặt chưng mở nắp 2 phút cho vàng rực.', timerMinutes: 17 },
      { stepNumber: 3, instruction: 'Nướng sườn cốt lết trên than hồng hoặc lò 205°C trong 12 phút đến khi viền mỡ cháy xém thơm lừng.', timerMinutes: 12 },
      { stepNumber: 4, instruction: 'Nấu nước mắm đường kẹo sánh, xối dầu sôi vào chén hành lá làm mỡ hành xanh ngọc.' },
      { stepNumber: 5, instruction: 'Đơm cơm tấm nóng ra đĩa, đặt sườn nướng, lát chả trứng, dưa leo đồ chua, rưới mỡ hành và chan nước mắm kẹo.' }
    ]
  },
  {
    id: 'v5-nam-02',
    slug: 'lau-mam-mien-tay-song-nuoc',
    title: 'Lẩu mắm miền Tây cá hú ba rọi sả ớt đậm đà',
    description: 'Tinh hoa ẩm thực miệt vườn sông nước Cửu Long với nước lẩu nấu mắm cá linh cá sặc lọc kỹ thơm nức sả băm ngải bún, nhúng ngập rau đồng.',
    cuisine: 'vietnamese',
    category: 'mon_lau_tiec',
    region: 'nam',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bo-kho-banh-mi'),
    nutrition: { calories: 495, proteinG: 36, fatG: 24, carbG: 34 },
    tags: ['Miền Nam', 'Miền Tây', 'Lẩu mắm', 'Miệt vườn'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá hú hoặc cá basa tươi cắt khứa', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba rọi thái lát vừa', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi & mực ống', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'EGGPLANT', name: 'Cà tím cắt khúc chẻ tư', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FERMENTED_ANCHOVY_SAUCE', name: 'Mắm cá linh & cá sặc nấu lọc xương', requiredQuantity: 120, unit: 'ml' },
      { ingredientId: 'LEMONGRASS', name: 'Sả băm, ớt sừng & nước dừa tươi', requiredQuantity: 4, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Đun mắm với 400ml nước dừa tươi và 800ml nước hầm xương 10 phút cho rã thịt, lọc qua rây mịn bỏ sạch xương cặn.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Phi vàng sả băm tỏi ớt trên nồi lớn, trút thịt ba rọi vào xào săn thơm lừng.', timerMinutes: 4 },
      { stepNumber: 3, instruction: 'Đổ nước cốt mắm đã lọc vào nồi đun sôi, thả cà tím vào nấu 8 phút cho cà mềm ngọt thấm vị mắm.', tip: 'Nấu nước lẩu mắm bằng nước dừa xiêm giúp vị mắm dịu hậu ngọt thanh, dậy mùi mà không gắt mặn.', timerMinutes: 8 },
      { stepNumber: 4, instruction: 'Dọn nồi lẩu sôi lục bục ra bàn, nhúng cá tươi, tôm mực cùng rau muống, kèo nèo, bông súng ăn kèm bún tươi.' }
    ]
  },
  {
    id: 'v5-nam-03',
    slug: 'ca-tai-tuong-chien-xu-mien-tay',
    title: 'Cá tai tượng chiên xù vảy giòn cuốn bánh tráng',
    description: 'Đặc sản đãi khách miệt vườn Tiền Giang - Vĩnh Long với nguyên con cá tai tượng chiên đứng xòe vảy vàng rụm như cánh phượng, thịt trắng ngọt.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'nam',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'hard',
    imageUrl: DISH_IMG('ca-chien-mam-gung'),
    nutrition: { calories: 455, proteinG: 36, fatG: 24, carbG: 24 },
    tags: ['Miền Nam', 'Miền Tây', 'Cá chiên xù', 'Đãi tiệc'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá tai tượng tươi nguyên vảy làm sạch ruột', requiredQuantity: 850, unit: 'g' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng mỏng & bún tươi cuốn', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'PINEAPPLE', name: 'Thơm chín & dưa leo thái thanh dài', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'LETTUCE', name: 'Xà lách, rau thơm & chuối chát', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'TAMARIND', name: 'Me vắt pha nước mắm me chấm cá', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn xối ngập vảy cá', requiredQuantity: 150, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Mổ bụng làm sạch ruột và mang cá nhưng giữ nguyên toàn bộ lớp vảy, thấm thật khô ráo cả trong lẫn ngoài thân cá.', tip: 'Giữ nguyên vảy và lau thật khô nước giúp khi gặp dầu sôi từng chiếc vảy cá bung xòe giòn tan như bánh phồng.' },
      { stepNumber: 2, instruction: 'Đun chảo dầu sâu lòng sôi già ở 180°C, đặt cá lên vợt inox đỡ dưới bụng và dùng vá múc dầu nóng xối đều liên tục lên mình cá 15 phút.', timerMinutes: 15 },
      { stepNumber: 3, instruction: 'Dầm me chín với nước ấm lọc lấy cốt, nấu sôi cùng nước mắm, đường và tỏi ớt băm thành chén mắm me sánh chua ngọt.' },
      { stepNumber: 4, instruction: 'Dựng đứng cá tai tượng vàng rực trên đĩa lớn, gỡ cả vảy giòn lẫn thịt trắng cuốn bánh tráng rau sống chấm mắm me.' }
    ]
  },
  {
    id: 'v5-nam-04',
    slug: 'bo-kho-banh-mi-sa-que-sai-gon',
    title: 'Bò kho bánh mì sả quế hoa hồi Sài Gòn',
    description: 'Thịt nạm gân bò hầm mềm tan trong nước sốt đỏ cam sánh óng thơm ngát sả cây, quế thanh, đại hồi và cà rốt ngọt bùi chấm bánh mì nóng giòn.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'nam',
    cookTimeMinutes: 55,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bo-kho-banh-mi'),
    nutrition: { calories: 485, proteinG: 35, fatG: 22, carbG: 36 },
    tags: ['Miền Nam', 'Sài Gòn', 'Bò kho', 'Ăn sáng'],
    ingredients: [
      { ingredientId: 'BEEF_SHANK', name: 'Nạm gân bò cắt miếng vuông dày', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'CARROT', name: 'Cà rốt tỉa hoa cắt khúc dày', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'LEMONGRASS', name: 'Sả cây đập dập & tỏi băm', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'STAR_ANISE', name: 'Hoa hồi & quế thanh rang thơm', requiredQuantity: 8, unit: 'g' },
      { ingredientId: 'COCONUT_WATER', name: 'Nước dừa tươi xiêm ngọt', requiredQuantity: 500, unit: 'ml' },
      { ingredientId: 'THAI_BASIL', name: 'Rau húng quế & ngò gai ăn kèm', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần sơ nạm bò với rượu gừng, rửa sạch rồi ướp dầu màu điều, ngũ vị hương, tỏi băm, mắm đường trong 25 phút.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Phi thơm sả đập dập cùng hoa hồi quế thanh, trút thịt bò vào xào lửa lớn 5 phút cho miếng bò săn lại.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Đổ nước dừa tươi và 500ml nước sôi vào hầm lửa nhỏ 35 phút cho gân bò mềm dẻo trong veo.', tip: 'Rang khô hoa hồi và quế thanh trước khi cho vào nồi rồi vớt ra sau 20 phút để hương thơm thanh tao không bị nồng đắng.', timerMinutes: 35 },
      { stepNumber: 4, instruction: 'Thả cà rốt vào nấu tiếp 12 phút đến khi vừa mềm ngọt và nước sốt bò kho sánh bóng.', timerMinutes: 12 },
      { stepNumber: 5, instruction: 'Múc bò kho nóng ra tô, rắc hành tây ngò gai húng quế, chấm bánh mì đặc ruột giòn rụm và muối tiêu chanh.' }
    ]
  },
  {
    id: 'v5-nam-05',
    slug: 'vit-nau-chao-khoai-mon-can-tho',
    title: 'Vịt nấu chao khoai môn bùi béo Cần Thơ',
    description: 'Đặc sản trứ danh đất Tây Đô với thịt vịt xiêm ướp chao đỏ chao trắng thơm ngậy, hầm nước dừa tươi cùng khoai môn cao bở tơi béo mịn.',
    cuisine: 'vietnamese',
    category: 'mon_lau_tiec',
    region: 'nam',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bo-kho-banh-mi'),
    nutrition: { calories: 520, proteinG: 33, fatG: 29, carbG: 31 },
    tags: ['Miền Nam', 'Cần Thơ', 'Vịt nấu chao', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'DUCK_MEAT', name: 'Thịt vịt xiêm chặt miếng to vừa', requiredQuantity: 700, unit: 'g' },
      { ingredientId: 'TARO', name: 'Khoai môn cao cắt quân cờ lớn', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'FERMENTED_TOFU', name: 'Chao môn trắng & chao đỏ tán nhuyễn', requiredQuantity: 80, unit: 'g' },
      { ingredientId: 'COCONUT_WATER', name: 'Nước dừa tươi ngọt thanh', requiredQuantity: 600, unit: 'ml' },
      { ingredientId: 'WATER_SPINACH', name: 'Rau muống cọng & cải bẹ xanh nhúng', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'GINGER', name: 'Gừng, tỏi & sả băm thơm', requiredQuantity: 30, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chà sạch vịt với gừng giã và rượu trắng, chặt miếng rồi ướp với 50g chao tán nhuyễn, tỏi sả băm và chút đường 25 phút.', timerMinutes: 25 },
      { stepNumber: 2, instruction: 'Chiên sơ các mặt miếng khoai môn trong 4 phút để tạo lớp áo vàng giúp khoai khi nấu bùi dẻo không bị bể nát.', tip: 'Chiên áo mặt khoai môn trước là bí quyết giữ nước lẩu chao sánh mịn mà miếng khoai vẫn nguyên vẹn.', timerMinutes: 4 },
      { stepNumber: 3, instruction: 'Phi thơm tỏi sả, xào săn thịt vịt rồi đổ nước dừa tươi vào hầm lửa nhỏ 20 phút.', timerMinutes: 20 },
      { stepNumber: 4, instruction: 'Thả khoai môn vào nấu thêm 10 phút cho mềm bùi, pha phần chao còn lại với cốt dừa đường chanh làm chén chấm kèm bún và rau muống.', timerMinutes: 10 }
    ]
  },
  {
    id: 'v5-nam-06',
    slug: 'ga-ro-ti-nuoc-dua-tuoi-nam-bo',
    title: 'Gà rô ti nước dừa xiêm vàng óng Nam Bộ',
    description: 'Đùi gà góc tư ướp tỏi ngũ vị chiên săn da rồi khìa chậm trong nước dừa xiêm tươi đến khi lên màu nâu đỏ óng ánh ngọt đậm khó cưỡng.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'nam',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('ga-kho-gung'),
    nutrition: { calories: 440, proteinG: 36, fatG: 24, carbG: 18 },
    tags: ['Miền Nam', 'Gà rô ti', 'Nước dừa', 'Trẻ em mê'],
    ingredients: [
      { ingredientId: 'CHICKEN_THIGH', name: 'Đùi gà góc tư khía nhẹ mặt trong', requiredQuantity: 700, unit: 'g' },
      { ingredientId: 'COCONUT_WATER', name: 'Nước dừa xiêm tươi nguyên chất', requiredQuantity: 400, unit: 'ml' },
      { ingredientId: 'GARLIC', name: 'Tỏi & hành tím băm nhuyễn', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FIVE_SPICE', name: 'Bột ngũ vị hương thơm dịu', requiredQuantity: 4, unit: 'g' },
      { ingredientId: 'SOY_SAUCE', name: 'Nước tương & dầu hào', requiredQuantity: 30, unit: 'ml' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn áp chảo gà', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp đùi gà với hành tỏi băm, nước tương, dầu hào và xíu ngũ vị hương trong 20 phút.', timerMinutes: 20 },
      { stepNumber: 2, instruction: 'Áp chảo mặt da gà xuống trước trên lửa vừa 6 phút cho da căng vàng óng ả.', timerMinutes: 6 },
      { stepNumber: 3, instruction: 'Rót ngập 400ml nước dừa xiêm tươi vào chảo, hạ lửa nhỏ khìa không đậy nắp 20 phút đồng thời múc nước dừa rưới đều lên da gà.', tip: 'Đường tự nhiên trong nước dừa xiêm khi cạn sẽ tự lên màu hổ phách bóng gương tuyệt đẹp mà không cần thắng màu.', timerMinutes: 20 },
      { stepNumber: 4, instruction: 'Khi sốt keo sánh óng ánh bám quanh đùi gà thì tắt bếp, chặt miếng ăn kèm cơm nóng và dưa leo cà chua.' }
    ]
  },
  {
    id: 'v5-nam-07',
    slug: 'bo-luc-lac-tieu-xanh-sai-gon',
    title: 'Bò lúc lắc tiêu xanh ớt chuông bơ tỏi Sài Gòn',
    description: 'Những viên thăn bò vuông vức áp chảo lửa rực bơ tỏi thơm ngậy, bên ngoài cháy cạnh bên trong hồng mọng nước quyện ớt chuông và xà lách xoong.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'nam',
    cookTimeMinutes: 20,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('bo-xao-can-toi'),
    nutrition: { calories: 385, proteinG: 32, fatG: 21, carbG: 16 },
    tags: ['Miền Nam', 'Sài Gòn', 'Bò lúc lắc', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'BEEF_SIRLOIN', name: 'Thăn ngoại bò mềm cắt quân cờ 2.5cm', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'BELL_PEPPER', name: 'Ớt chuông xanh đỏ cắt vuông', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'ONION', name: 'Hành tây cắt miếng vuông', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'BUTTER', name: 'Bơ lạt thơm béo', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'WATERCRESS', name: 'Xà lách xoong lót đĩa', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'OYSTER_SAUCE', name: 'Dầu hào, nước tương & tiêu hạt đập', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp viên bò quân cờ với dầu hào, nước tương, tiêu đập dập và 1 thìa dầu ăn trong 15 phút để khóa ẩm.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Đun chảo gang bốc khói trên lửa cực lớn, đảo nhanh ớt chuông và hành tây 1 phút cho chín giòn xém cạnh rồi trút ra.', timerMinutes: 1 },
      { stepNumber: 3, instruction: 'Trải đều bò vào chảo nóng để yên 45 giây cho cháy cạnh rồi mới lắc chảo nhanh 1 phút cùng viên bơ lạt và tỏi đập.', tip: 'Không đảo bò ngay khi vừa chạm chảo giúp tạo lớp vỏ caramel thơm ngọt giữ trọn nước ngọt hồng bên trong.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Trộn nhẹ rau củ trở lại chảo 15 giây, bày lên thảm xà lách xoong chấm muối tiêu chanh.' }
    ]
  },
  {
    id: 'v5-nam-08',
    slug: 'hu-tieu-nam-vang-sai-gon',
    title: 'Hủ tiếu Nam Vang tôm thịt trứng cút nước trong',
    description: 'Tô hủ tiếu danh tiếng đất Sài Gòn với sợi hủ tiếu dai trong, nước lèo xương mực nướng ngọt thanh khiết, tôm sú, thịt bằm xào và tỏi phi vàng.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'nam',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('pho-bo-ha-noi'),
    nutrition: { calories: 475, proteinG: 33, fatG: 13, carbG: 55 },
    tags: ['Miền Nam', 'Sài Gòn', 'Hủ tiếu', 'Ăn sáng'],
    ingredients: [
      { ingredientId: 'NOODLE', name: 'Hủ tiếu dai Mỹ Tho / Sa Đéc', requiredQuantity: 450, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi bóc vỏ chừa đuôi', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc heo xay & thịt thăn luộc', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'QUAIL_EGG', name: 'Trứng cút luộc chín', requiredQuantity: 8, unit: 'piece' },
      { ingredientId: 'DAIKON_RADISH', name: 'Củ cải trắng hầm ngọt nước', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'GARLIC', name: 'Tỏi băm phi vàng giòn ngập dầu', requiredQuantity: 3, unit: 'piece' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Hầm xương và khối thịt thăn cùng củ cải trắng trên lửa nhỏ 30 phút, hớt bọt kỹ cho nước lèo trong veo.', timerMinutes: 30 },
      { stepNumber: 2, instruction: 'Phi tỏi băm vàng óng thơm lừng, vớt riêng phần tỏi vàng cùng chút dầu tỏi để trộn hủ tiếu.' },
      { stepNumber: 3, instruction: 'Xào tơi thịt heo xay với chút nước mắm và múc 1 vá nước hầm vào đánh tan để thịt mềm ngọt; chần chín tôm sú đỏ tươi.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Trụng sợi hủ tiếu dai rồi xóc ngay với nửa muỗng dầu tỏi phi để sợi tơi bóng thơm phức.', tip: 'Áo lớp dầu tỏi phi ngay khi vừa trụng là bí quyết tạo nên hương thơm đặc trưng của hủ tiếu Sài Gòn.' },
      { stepNumber: 5, instruction: 'Xếp thịt thăn thái mỏng, thịt bằm, tôm, trứng cút lên tô, chan nước lèo nóng rắc hẹ cần tàu ăn kèm giá sống.' }
    ]
  },
  {
    id: 'v5-nam-09',
    slug: 'tep-dong-rang-dua-ben-tre',
    title: 'Tép đồng rang nước cốt dừa lá chanh Bến Tre',
    description: 'Đặc sản xứ Dừa mộc mạc mà gây thương nhớ với con tép bạc đất rang bóng mướt trong nước cốt dừa béo ngậy, mặn ngọt hài hòa.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'nam',
    cookTimeMinutes: 18,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('tom-rim-mam'),
    nutrition: { calories: 310, proteinG: 26, fatG: 17, carbG: 13 },
    tags: ['Miền Nam', 'Bến Tre', 'Tép rang dừa', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tép bạc đất tươi cắt râu để nguyên vỏ', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'COCONUT_MILK', name: 'Nước cốt dừa tươi béo sánh', requiredQuantity: 120, unit: 'ml' },
      { ingredientId: 'SHALLOT', name: 'Hành tím & tỏi băm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 25, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát vàng', requiredQuantity: 18, unit: 'g' },
      { ingredientId: 'SCALLION', name: 'Hành lá thái nhỏ', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rửa sạch tép bạc để ráo nước, ướp nhẹ với 10g đường trước 10 phút giúp vỏ tép khi rang trong giòn bóng đẹp.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Phi thơm hành tỏi, cho tép vào đảo lửa lớn 3 phút đến khi tép săn đỏ.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Rót 120ml nước cốt dừa và nước mắm vào rim lửa vừa 6 phút đến khi cốt dừa tươm dầu béo bóng bám chặt quanh vỏ tép.', tip: 'Rim đến khi nước cốt dừa chuyển sang lớp dầu dừa trong veo óng ánh giúp con tép thơm béo mà không bị ướt.', timerMinutes: 6 },
      { stepNumber: 4, instruction: 'Rắc hành lá và tiêu xay vào đảo nhanh tắt bếp, ăn kèm cơm nóng và rau luộc.' }
    ]
  },
  {
    id: 'v5-nam-10',
    slug: 'kho-qua-xao-trung-nam-bo',
    title: 'Khổ qua xào trứng vịt hành lá giòn bùi Nam Bộ',
    description: 'Món cơm nhà thanh mát khắp phương Nam với lát khổ qua xanh giòn nhẩn đắng hậu ngọt quyện từng chùm trứng vàng béo thơm.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'nam',
    cookTimeMinutes: 12,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-kho-qua'),
    nutrition: { calories: 205, proteinG: 14, fatG: 12, carbG: 9 },
    tags: ['Miền Nam', 'Thanh nhiệt', 'Dưới 20 phút', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'BITTER_MELON', name: 'Khổ qua đèo xanh mướt bỏ ruột bào mỏng', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'DUCK_EGG', name: 'Trứng vịt hoặc trứng gà ta', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'GARLIC', name: 'Tỏi & hành tím băm thơm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành lá thái nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon & dầu ăn', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Bổ đôi trái khổ qua cạo sạch lớp màng trắng trong ruột để giảm đắng gắt, thái lát mỏng ngâm đá lạnh 5 phút rồi vẩy ráo.', tip: 'Cạo sạch lớp cùi trắng sát hạt và xào lửa thật lớn giúp khổ qua giòn xanh dịu đắng.', timerMinutes: 5 },
      { stepNumber: 2, instruction: 'Đánh tan trứng cùng 10ml nước mắm và tiêu xay.' },
      { stepNumber: 3, instruction: 'Phi thơm tỏi trên chảo lửa lớn, trút khổ qua vào xào nhanh 2 phút cho vừa chuyển xanh trong.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Rưới đều trứng lên mặt khổ qua, chờ 20 giây cho trứng se mảng lớn rồi đảo nhẹ rắc hành lá tiêu đen tắt bếp.' }
    ]
  },
  {
    id: 'v5-nam-11',
    slug: 'chao-ca-loc-rau-dang-mien-tay',
    title: 'Cháo cá lóc đồng nấm rơm rau đắng miền Tây',
    description: 'Nồi cháo nóng hổi giải cảm đậm chất miền Tây sông nước với khứa cá lóc đồng chắc ngọt, nấm rơm búp tròn nhúng rau đắng đất thanh mát.',
    cuisine: 'vietnamese',
    category: 'mon_nhanh_sang',
    region: 'nam',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('chao-ga-gung'),
    nutrition: { calories: 335, proteinG: 29, fatG: 7, carbG: 37 },
    tags: ['Miền Nam', 'Miền Tây', 'Cháo cá lóc', 'Giải cảm'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá lóc đồng tươi làm sạch', requiredQuantity: 600, unit: 'g' },
      { ingredientId: 'RICE', name: 'Gạo dẻo thơm rang vàng nhẹ', requiredQuantity: 160, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm rơm búp tròn gọt sạch', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'WATERCRESS', name: 'Rau đắng đất / Rau xanh nhúng cháo', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'GINGER', name: 'Gừng tươi thái chỉ & hành lá', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm mặn dầm ớt hiểm', requiredQuantity: 30, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Luộc chín nguyên con cá lóc trong 1.6 lít nước có củ hành nướng và lát gừng trong 12 phút, vớt cá ra đĩa giữ nguyên khứa.', timerMinutes: 12 },
      { stepNumber: 2, instruction: 'Trút gạo rang vàng vào nồi nước luộc cá nấu nhỏ lửa 18 phút đến khi hạt gạo vừa bung nở.', timerMinutes: 18 },
      { stepNumber: 3, instruction: 'Phi tỏi mỡ thơm lừng, xào sơ nấm rơm rồi trút vào nồi cháo đun thêm 4 phút, nêm nước mắm vừa ăn.', tip: 'Rang gạo hơi ngả vàng trước khi nấu giúp cháo cá miền Tây thơm bùi và hạt cháo tơi ráo không bị đặc sệt.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Lót rau đắng dưới đáy tô, múc cháo sôi sục lên trên làm rau vừa chín tái, đặt khứa cá lóc chấm mắm ớt.' }
    ]
  },
  {
    id: 'v5-nam-12',
    slug: 'ca-hu-kho-to-nuoc-dua-nam-bo',
    title: 'Cá hú kho tộ nước dừa tóp mỡ tiêu xanh',
    description: 'Khứa cá hú béo mềm da trơn bóng kho trong tộ đất với nước dừa tươi màu cánh gián kẹo sánh, dậy mùi tóp mỡ ba rọi và chùm tiêu xanh cay the.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'nam',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('ca-kho-to'),
    nutrition: { calories: 410, proteinG: 31, fatG: 23, carbG: 18 },
    tags: ['Miền Nam', 'Cá kho tộ', 'Niêu đất', 'Đưa cơm'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá hú tươi cắt khứa dày 2.5cm', requiredQuantity: 550, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Mỡ heo / Ba rọi thái nhỏ thắng tóp mỡ', requiredQuantity: 100, unit: 'g' },
      { ingredientId: 'COCONUT_WATER', name: 'Nước dừa tươi', requiredQuantity: 200, unit: 'ml' },
      { ingredientId: 'CARAMEL_SAUCE', name: 'Nước màu dừa Bến Tre', requiredQuantity: 15, unit: 'ml' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm Phú Quốc & đường', requiredQuantity: 45, unit: 'ml' },
      { ingredientId: 'SCALLION', name: 'Hành lá, ớt hiểm & tiêu xanh', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chà sạch nhớt cá hú bằng nước cốt chanh và muối, rửa ráo rồi ướp nước màu dừa, mắm đường, đầu hành băm 20 phút.', timerMinutes: 20 },
      { stepNumber: 2, instruction: 'Thắng ba rọi trong tộ đất lấy tóp mỡ vàng giòn, vớt tóp mỡ để riêng rồi xếp khứa cá vào trở nhẹ hai mặt cho săn.' },
      { stepNumber: 3, instruction: 'Rót 200ml nước dừa tươi xâm xấp mặt cá, kho lửa riu riu không đậy nắp 18 phút cho nước kho sánh kẹo.', tip: 'Mở nắp suốt lúc kho giúp hơi tanh bay hết và thịt cá hú béo mà vẫn dẻo săn.', timerMinutes: 18 },
      { stepNumber: 4, instruction: 'Rắc tóp mỡ giòn, hành lá và ớt hiểm lên trên, bưng nguyên tộ đất còn sôi lục bục ra bàn.' }
    ]
  },
  {
    id: 'v5-nam-13',
    slug: 'banh-canh-cua-gio-heo-sai-gon',
    title: 'Bánh canh cua giò heo nấm rơm sánh sệt Sài Gòn',
    description: 'Tô bánh canh bột lọc cam đỏ hấp dẫn của đường phố Sài Gòn với càng cua thịt chắc, tôm tươi, khoanh giò heo và nước súp sánh mượt đậm đà.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'nam',
    cookTimeMinutes: 45,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('pho-bo-ha-noi'),
    nutrition: { calories: 510, proteinG: 35, fatG: 17, carbG: 53 },
    tags: ['Miền Nam', 'Sài Gòn', 'Bánh canh cua', 'Đặc sản'],
    ingredients: [
      { ingredientId: 'CRAB_MEAT', name: 'Thịt cua biển gỡ múi tươi ngọt', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'PORK_HOCK', name: 'Chân giò heo rút xương hoặc chặt khoanh', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi bóc vỏ', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Sợi bánh canh bột năng dai trong', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm rơm búp tươi', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'ANNATTO_SEED', name: 'Dầu màu điều, hành ngò & nước mắm', requiredQuantity: 15, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ninh mềm chân giò heo với 1.6 lít nước và củ cải trong 30 phút lấy nước dùng ngọt thanh.', timerMinutes: 30 },
      { stepNumber: 2, instruction: 'Phi hành tỏi trong dầu màu điều cam óng, xào thơm thịt cua biển và tôm sú cùng chút tiêu mắm 2 phút rồi trút riêng.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Thả nấm rơm và sợi bánh canh đã trụng sạch vào nồi nước dùng đun 5 phút để tạo độ sánh nhẹ mượt mà.', tip: 'Trụng sơ sợi bánh canh bột năng qua nước sôi trước giúp nước lèo trong bóng không bị chua bột.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Múc bánh canh nóng ra tô, bày đầy ắp thịt cua, tôm đỏ, khoanh giò heo, rắc ngò rí hành phi và tiêu xay.' }
    ]
  },
  {
    id: 'v5-nam-14',
    slug: 'bun-mam-soc-trang-mien-tay',
    title: 'Bún mắm Sóc Trăng tôm mực ba rọi sả thơm',
    description: 'Đặc sản giao thoa văn hóa miền Tây Nam Bộ với nước lèo mắm ngải bún nâu trong sóng sánh, đầy đặn tôm sú, mực khứa hoa và cà tím mềm.',
    cuisine: 'vietnamese',
    category: 'mon_bun_pho',
    region: 'nam',
    cookTimeMinutes: 40,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('bun-bo-hue'),
    nutrition: { calories: 490, proteinG: 34, fatG: 16, carbG: 52 },
    tags: ['Miền Nam', 'Sóc Trăng', 'Bún mắm', 'Miền Tây'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi bóc vỏ chừa đuôi', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'SQUID', name: 'Mực ống khứa vảy thông', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba rọi quay giòn hoặc luộc thái miếng', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'NOODLE', name: 'Bún tươi sợi vừa', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'EGGPLANT', name: 'Cà tím cắt múi cau', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FERMENTED_ANCHOVY_SAUCE', name: 'Mắm cá linh sặc lọc trong & sả băm', requiredQuantity: 100, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Nấu tan mắm cùng nước dừa tươi và nước xương hầm, lọc kỹ qua rây mịn rồi phi thơm sả băm trút vào nồi đun sôi.', timerMinutes: 12 },
      { stepNumber: 2, instruction: 'Thả cà tím vào nồi nước lèo nấu 6 phút cho mềm dẻo mà không nát vỏ.', timerMinutes: 6 },
      { stepNumber: 3, instruction: 'Chần chín tới tôm sú và mực ống ngay trong nồi nước lèo đang sôi 2 phút rồi vớt ra giữ độ giòn ngọt.', tip: 'Bày thịt ba rọi quay da giòn lên mặt sau khi chan nước lèo giúp lớp bì heo vẫn giòn rụm khi thưởng thức.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Xếp bún tươi, giá hẹ rau đắng dưới tô, bày tôm mực cà tím ba rọi và chan ngập nước lèo mắm thơm lừng chấm mắm me.' }
    ]
  },
  {
    id: 'v5-nam-15',
    slug: 'goi-ngo-sen-tom-thit-dong-thap',
    title: 'Gỏi ngó sen tôm thịt giòn trắng Đồng Tháp',
    description: 'Món khai vị tiệc cưới nức tiếng miền Nam với cọng ngó sen trắng ngần giòn rụm ngâm chua ngọt, trộn tôm thẻ đỏ tươi, thịt ba chỉ và rau răm.',
    cuisine: 'vietnamese',
    category: 'mon_cuon_nom',
    region: 'nam',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('goi-cuon-tom-thit'),
    nutrition: { calories: 275, proteinG: 25, fatG: 9, carbG: 23 },
    tags: ['Miền Nam', 'Đồng Tháp', 'Gỏi ngó sen', 'Món tiệc'],
    ingredients: [
      { ingredientId: 'LOTUS_ROOT', name: 'Ngó sen non chẻ đôi cắt khúc', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm sú luộc bóc vỏ chẻ đôi', requiredQuantity: 200, unit: 'g' },
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ luộc thái sợi', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'CARROT', name: 'Cà rốt & hành tây thái sợi', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'LIME', name: 'Chanh tươi vắt nước cốt', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm, đường & rau răm', requiredQuantity: 35, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ngâm ngay ngó sen vừa cắt vào thau nước đá pha cốt 1 quả chanh trong 10 phút cho trắng tinh giòn rụm, vớt để ráo.', tip: 'Ướp ngó sen ráo nước với 1 thìa đường và giấm trước 10 phút rồi chắt bỏ nước tiết ra giúp gỏi cực giòn.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Luộc chín tôm sú và thịt ba chỉ, thái mỏng đều tay.' },
      { stepNumber: 3, instruction: 'Khuấy sánh 35ml nước mắm ngon, 35g đường, nước cốt chanh và tỏi ớt băm.' },
      { stepNumber: 4, instruction: 'Trộn đều ngó sen, cà rốt, tôm thịt với nước mắm gỏi và rau răm, rắc hành phi đậu phộng ăn kèm bánh phồng tôm.' }
    ]
  },
  {
    id: 'v5-nam-16',
    slug: 'cha-gio-re-tom-thit-nam-bo',
    title: 'Chả giò tôm thịt khoai môn giòn tan Nam Bộ',
    description: 'Cuốn chả giò vàng ươm rôm rốp trên bàn tiệc phương Nam với nhân khoai môn bào bùi béo quyện thịt nạc dăm, tôm tươi băm và hành tím thơm.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'nam',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('nem-ran-cha-gio'),
    nutrition: { calories: 395, proteinG: 22, fatG: 21, carbG: 30 },
    tags: ['Miền Nam', 'Chả giò', 'Giòn rụm', 'Đãi tiệc'],
    ingredients: [
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc dăm xay dẻo', requiredQuantity: 250, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm tươi quết nhuyễn dai giòn', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'TARO', name: 'Khoai môn cao bào sợi mịn', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm mèo ngâm nở thái chỉ', requiredQuantity: 30, unit: 'g' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng cuốn chả giò giòn', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn chiên ngập mặt', requiredQuantity: 120, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Hong sợi khoai môn nơi thoáng gió 15 phút cho se khô mặt, sau đó trộn đều với thịt xay, tôm quết, nấm mèo, tiêu mắm.', tip: 'Khoai môn ráo nước hút bớt độ ẩm của nhân thịt giúp cuốn chả giò Nam Bộ bùi thơm và giữ vỏ giòn rất lâu.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Cuốn nhân thành từng cuốn thon đều tay, dán mép bằng chút lòng trắng trứng.' },
      { stepNumber: 3, instruction: 'Thả chả giò vào dầu nóng vừa (160°C) chiên chậm 12 phút để khoai môn và thịt bên trong chín bùi từ từ mà vỏ vàng đều.', timerMinutes: 12 },
      { stepNumber: 4, instruction: 'Vớt ra giấy thấm dầu, cuốn xà lách rau sống bún tươi chấm nước mắm chua ngọt đồ chua.' }
    ]
  },
  {
    id: 'v5-nam-17',
    slug: 'suon-cot-let-rim-nuoc-dua-sai-gon',
    title: 'Sườn cốt lết rim mặn ngọt nước dừa tỏi phi',
    description: 'Miếng sườn cốt lết bản lớn rim mềm mọng trong nước dừa tươi mặn ngọt bóng bẩy, phủ tỏi phi vàng giòn ăn hết sạch nồi cơm nhà.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    region: 'nam',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('suon-xao-chua-ngot'),
    nutrition: { calories: 435, proteinG: 31, fatG: 26, carbG: 18 },
    tags: ['Miền Nam', 'Sài Gòn', 'Sườn rim', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'PORK_RIBS', name: 'Sườn cốt lết cắt lát dày 1cm', requiredQuantity: 500, unit: 'g' },
      { ingredientId: 'COCONUT_WATER', name: 'Nước dừa tươi', requiredQuantity: 250, unit: 'ml' },
      { ingredientId: 'GARLIC', name: 'Tỏi băm nhiều phi thơm', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm Phú Quốc', requiredQuantity: 30, unit: 'ml' },
      { ingredientId: 'OYSTER_SAUCE', name: 'Dầu hào & chút đường vàng', requiredQuantity: 15, unit: 'ml' },
      { ingredientId: 'SCALLION', name: 'Hành lá thái nhỏ', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Khía nhẹ viền mỡ miếng cốt lết để khi chiên không bị cong vênh, ướp nước mắm, dầu hào và tiêu 15 phút.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Phi vàng tỏi băm vớt riêng một nửa, dùng chảo dầu tỏi áp chảo sườn vàng sém hai mặt trong 5 phút.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Rót 250ml nước dừa tươi vào rim lửa nhỏ vừa 12 phút đến khi nước dừa cạn thành lớp sốt nâu óng quyện quanh miếng thịt.', tip: 'Khía đứt đường gân viền ngoài giúp lát cốt lết phẳng đẹp và thấm đều sốt dừa.', timerMinutes: 12 },
      { stepNumber: 4, instruction: 'Rắc tỏi phi giòn và hành lá lên mặt sườn, dùng nóng với cơm trắng và dưa leo.' }
    ]
  },
  {
    id: 'v5-nam-18',
    slug: 'canh-chua-tom-dau-bap-mien-tay',
    title: 'Canh chua tôm tươi đậu bắp bạc hà miền Tây',
    description: 'Tô canh chua chuẩn miệt vườn Nam Bộ với tôm sú đỏ au ngọt chắc, nước me chua dịu ngọt thanh điểm đậu bắp, bạc hà giòn xốp và tỏi phi thơm.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'nam',
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-chua-ca'),
    nutrition: { calories: 235, proteinG: 24, fatG: 6, carbG: 22 },
    tags: ['Miền Nam', 'Miền Tây', 'Canh chua tôm', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SHRIMP', name: 'Tôm sú tươi bóc vỏ chừa đuôi', requiredQuantity: 350, unit: 'g' },
      { ingredientId: 'OKRA', name: 'Đậu bắp non cắt xéo', requiredQuantity: 180, unit: 'g' },
      { ingredientId: 'TOMATO', name: 'Cà chua & thơm chín thái miếng', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'BEAN_SPROUTS', name: 'Giá đỗ sống & bạc hà (dọc mùng)', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'TAMARIND', name: 'Me vắt dầm nước sôi lọc cốt', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'RICE_PADDY_HERB', name: 'Ngò ôm, ngò gai & tỏi phi vàng', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Phi vàng giòn tỏi băm trong nồi rồi múc phần xác tỏi cùng chút dầu vàng ra chén để rắc sau cùng.' },
      { stepNumber: 2, instruction: 'Xào thơm và cà chua trong nồi, đổ 1.1 lít nước sôi cùng nước cốt me, chút đường và nước mắm đun sôi.', timerMinutes: 5 },
      { stepNumber: 3, instruction: 'Thả tôm tươi và đậu bắp vào nấu lửa vừa đúng 3 phút cho tôm cong đỏ giòn và đậu bắp xanh mướt.', tip: 'Rắc tỏi phi vàng óng cùng ngò ôm lên mặt bát canh lúc múc ra là bí quyết tạo hương thơm đặc trưng canh chua Nam Bộ.', timerMinutes: 3 },
      { stepNumber: 4, instruction: 'Cho giá đỗ và bạc hà vào đảo nhẹ rồi tắt bếp ngay, múc ra tô rắc ngò ôm ngò gai, ớt lát và tỏi phi.' }
    ]
  },
  {
    id: 'v5-nam-19',
    slug: 'canh-bau-nau-tom-tuoi-nam-bo',
    title: 'Canh bầu sao nấu tôm tươi giã dập ngọt lịm',
    description: 'Bát canh trưa nắng mộc mạc phương Nam với trái bầu sao non thái râu tôm nấu cùng tôm thẻ tươi quết dập ngọt lịm không cần xương hầm.',
    cuisine: 'vietnamese',
    category: 'mon_canh',
    region: 'nam',
    cookTimeMinutes: 15,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-chua-ca'),
    nutrition: { calories: 165, proteinG: 20, fatG: 4, carbG: 12 },
    tags: ['Miền Nam', 'Canh bầu', 'Dưới 20 phút', 'Thanh mát'],
    ingredients: [
      { ingredientId: 'BOTTLE_GOURD', name: 'Trái bầu sao non gọt vỏ băm sợi ngắn', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'SHRIMP', name: 'Tôm thẻ tươi bóc vỏ đập dập băm sơ', requiredQuantity: 220, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Đầu hành lá & hành tím giã với tôm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'CILANTRO', name: 'Hành lá & ngò rí thái nhỏ', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon & tiêu xay', requiredQuantity: 15, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Giã dập thịt tôm cùng gốc hành trắng và tiêu sọ để khi nấu thịt tôm kết thành từng viên ngọt đậm.' },
      { stepNumber: 2, instruction: 'Đun sôi 1 lít nước, dùng muỗng múc từng viên tôm thả vào đun 3 phút và hớt bọt.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Thả bầu sao thái sợi ngắn vào nồi đang sôi lớn, đun đúng 2 phút đến khi sợi bầu vừa chuyển trong rồi tắt bếp.', tip: 'Chọn trái bầu non hạt trắng và tắt bếp ngay khi bầu vừa trong giúp canh ngọt mát không bị chua nhũn.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Nêm chút nước mắm cốt, rắc hành ngò và tiêu đen xay thơm nồng.' }
    ]
  },
  {
    id: 'v5-nam-20',
    slug: 'muop-huong-xao-thit-ga-nam-bo',
    title: 'Mướp hương xào thịt gà nấm rơm thơm ngọt',
    description: 'Mướp hương non xào lửa lớn giữ màu xanh ngọc thơm ngát mùi cốm, quyện nấm rơm búp tròn mọng nước và phi lê gà mềm ngọt.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'nam',
    cookTimeMinutes: 15,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('rau-muong-xao'),
    nutrition: { calories: 235, proteinG: 24, fatG: 8, carbG: 16 },
    tags: ['Miền Nam', 'Mướp hương', 'Dưới 20 phút', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'SPONGE_GOURD', name: 'Mướp hương non gọt vỏ cắt vát dày', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'CHICKEN_BREAST', name: 'Thịt gà mềm thái lát mỏng', requiredQuantity: 220, unit: 'g' },
      { ingredientId: 'MUSHROOM', name: 'Nấm rơm tươi chẻ đôi', requiredQuantity: 150, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành tím & tỏi băm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành lá & ngò rí cắt khúc', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm & dầu ăn', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp thịt gà thái mỏng với hành tím băm, 10ml nước mắm và tiêu trong 10 phút.', timerMinutes: 10 },
      { stepNumber: 2, instruction: 'Phi thơm tỏi, xào săn thịt gà và nấm rơm trên lửa lớn 3 phút.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Trút mướp hương cắt vát dày vào đảo nhanh trên lửa lớn 2 phút không châm thêm nước vì mướp tự tiết nước ngọt.', tip: 'Cắt miếng mướp vát dày và không đậy vung giúp mướp giữ màu xanh mướt không bị thâm đen.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Thêm hành lá ngò rí và tiêu xay, trút nóng ra đĩa sâu lòng.' }
    ]
  },
  {
    id: 'v5-nam-21',
    slug: 'muc-xao-sa-te-can-tau-sai-gon',
    title: 'Mực ống xào sa tế hành tây cần tàu Sài Gòn',
    description: 'Mực ống tươi dày giòn sần sật xóc lửa lớn cùng sa tế sả ớt đỏ óng thơm cay, điểm hành tây, cà chua và rau cần tàu dậy vị.',
    cuisine: 'vietnamese',
    category: 'mon_xao',
    region: 'nam',
    cookTimeMinutes: 16,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('bo-xao-can-toi'),
    nutrition: { calories: 260, proteinG: 27, fatG: 10, carbG: 15 },
    tags: ['Miền Nam', 'Sài Gòn', 'Mực xào', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'SQUID', name: 'Mực ống tươi khứa vảy rồng', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'SATAY_CHILI_OIL', name: 'Sa tế tôm sả ớt thơm cay', requiredQuantity: 20, unit: 'g' },
      { ingredientId: 'ONION', name: 'Hành tây thái múi cau', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'CELERY', name: 'Cần tàu & hành lá cắt khúc', requiredQuantity: 1, unit: 'bunch' },
      { ingredientId: 'GARLIC', name: 'Tỏi & gừng băm', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'OYSTER_SAUCE', name: 'Dầu hào & chút đường', requiredQuantity: 20, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Chần lướt mực khứa vảy rồng trong nước sôi gừng 20 giây cho săn giòn, vớt ráo hoàn toàn.' },
      { stepNumber: 2, instruction: 'Phi thơm tỏi gừng trên chảo thật nóng, cho mực cùng sa tế và dầu hào vào đảo lửa lớn 1.5 phút.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Thêm hành tây vào xóc nhanh 1 phút cho hành vừa chín giòn bám đều sốt sa tế cam đỏ.', tip: 'Chần sơ mực trước giúp đĩa mực xào khô ráo bóng sốt không hề đọng nước dưới đáy đĩa.', timerMinutes: 1 },
      { stepNumber: 4, instruction: 'Thả cần tàu hành lá đảo nhẹ tắt bếp, dùng nóng ngay với cơm trắng.' }
    ]
  },
  {
    id: 'v5-nam-22',
    slug: 'ca-loc-hap-bau-mien-tay',
    title: 'Cá lóc hấp bầu non mỡ hành cuốn bánh tráng',
    description: 'Trái bầu sao khoét ruột ôm trọn con cá lóc đồng ướp nấm mèo hành tím hấp chín ngọt thanh, phủ mỡ hành đậu phộng cuốn rau vườn.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'nam',
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'medium',
    imageUrl: DISH_IMG('ga-hap-la-chanh'),
    nutrition: { calories: 365, proteinG: 35, fatG: 12, carbG: 28 },
    tags: ['Miền Nam', 'Miền Tây', 'Cá hấp bầu', 'Đãi khách'],
    ingredients: [
      { ingredientId: 'FISH_FRESHWATER', name: 'Cá lóc đồng làm sạch khía mình', requiredQuantity: 650, unit: 'g' },
      { ingredientId: 'BOTTLE_GOURD', name: 'Trái bầu sao dài tươi non', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm mèo & nấm hương thái sợi', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'SCALLION', name: 'Hành lá nhiều làm mỡ hành & chẻ ngọn', requiredQuantity: 2, unit: 'bunch' },
      { ingredientId: 'RICE_PAPER', name: 'Bánh tráng & rau sống cuốn kèm', requiredQuantity: 1, unit: 'pack' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm chua ngọt tỏi ớt', requiredQuantity: 40, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ướp cá lóc đã khử tanh với đầu hành băm, nấm mèo thái sợi, chút nước mắm và tiêu trong 15 phút.', timerMinutes: 15 },
      { stepNumber: 2, instruction: 'Rửa sạch vỏ bầu sao, vạt nắp dọc thân và múc bớt ruột tạo chiếc thuyền bầu đặt vừa con cá lóc vào trong.' },
      { stepNumber: 3, instruction: 'Đặt vào xửng nước sôi hấp lửa vừa 22 phút để vị ngọt thanh của bầu thấm sâu vào từng thớ thịt cá.', tip: 'Giữ nguyên lớp vỏ xanh non của trái bầu sao giúp thuyền bầu giữ dáng đẹp mắt không bị nát khi hấp.', timerMinutes: 22 },
      { stepNumber: 4, instruction: 'Rưới ngập mỡ hành xanh bóng và hành phi lên lưng cá, dọn nóng cuốn bánh tráng rau sống.' }
    ]
  },
  {
    id: 'v5-nam-23',
    slug: 'mam-chung-thit-trung-sai-gon',
    title: 'Trứng vịt chưng thịt bằm nấm mèo Sài Gòn',
    description: 'Tô thịt trứng chưng cách thủy chắc mịn béo bùi chuẩn cơm tấm và cơm nhà Sài Gòn, phủ lớp lòng đỏ cam rực óng ả ăn kèm dưa leo mát.',
    cuisine: 'vietnamese',
    category: 'mon_hap_luoc',
    region: 'nam',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('trung-chien-thit'),
    nutrition: { calories: 330, proteinG: 26, fatG: 22, carbG: 6 },
    tags: ['Miền Nam', 'Sài Gòn', 'Chưng cách thủy', 'Cơm nhà'],
    ingredients: [
      { ingredientId: 'GROUND_PORK', name: 'Thịt nạc vai heo xay có mỡ', requiredQuantity: 300, unit: 'g' },
      { ingredientId: 'DUCK_EGG', name: 'Trứng vịt tươi (tách riêng 2 lòng đỏ quết mặt)', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm mèo ngâm nở băm nhỏ', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'SHALLOT', name: 'Hành tím băm nhuyễn', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon, chút đường & tiêu sọ', requiredQuantity: 25, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Trộn đều thịt xay, nấm mèo băm, hành tím, 2 quả trứng nguyên và 2 lòng trắng cùng nước mắm, tiêu xay.' },
      { stepNumber: 2, instruction: 'Cho hỗn hợp vào tô sứ thoa mỏng dầu ăn, đặt vào xửng hấp lửa vừa 20 phút đồng thời lau khô nước đọng dưới nắp vung.', timerMinutes: 20 },
      { stepNumber: 3, instruction: 'Đánh tan 2 lòng đỏ trứng còn lại với vài giọt dầu màu điều, phết đều lên mặt tô chả rồi mở nắp xửng chưng thêm 4 phút.', tip: 'Phải mở nắp xửng khi chưng lớp lòng đỏ trên mặt để hơi nước không nhỏ xuống làm nhạt màu vàng cam.', timerMinutes: 4 },
      { stepNumber: 4, instruction: 'Để nguội bớt rồi xắt miếng dày ăn kèm cơm nóng và dưa leo thái lát.' }
    ]
  },
  {
    id: 'v5-nam-24',
    slug: 'canh-ga-chien-bo-toi-sai-gon',
    title: 'Cánh gà chiên bơ tỏi thơm béo kiểu Sài Gòn',
    description: 'Cánh gà giữa chiên hai lửa giòn rụm mọng nước, xóc nhanh trong sốt bơ lạt tỏi phi vàng mặn ngọt béo thơm nức mũi cả nhà đều mê.',
    cuisine: 'vietnamese',
    category: 'mon_chien',
    region: 'nam',
    cookTimeMinutes: 25,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('canh-ga-chien-mam'),
    nutrition: { calories: 450, proteinG: 30, fatG: 31, carbG: 12 },
    tags: ['Miền Nam', 'Sài Gòn', 'Cánh gà bơ tỏi', 'Trẻ em mê'],
    ingredients: [
      { ingredientId: 'CHICKEN_WING', name: 'Cánh gà khúc giữa tươi sạch', requiredQuantity: 550, unit: 'g' },
      { ingredientId: 'BUTTER', name: 'Bơ lạt thơm ngậy', requiredQuantity: 35, unit: 'g' },
      { ingredientId: 'GARLIC', name: 'Tỏi băm nhuyễn nhiều', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'FISH_SAUCE', name: 'Nước mắm ngon', requiredQuantity: 20, unit: 'ml' },
      { ingredientId: 'SUGAR', name: 'Đường cát', requiredQuantity: 15, unit: 'g' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu ăn chiên giòn gà', requiredQuantity: 100, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Thấm thật khô cánh gà, xóc nhẹ chút muối tiêu rồi chiên ngập dầu lửa vừa 12 phút đến khi da vàng giòn rụm.', timerMinutes: 12 },
      { stepNumber: 2, instruction: 'Đun chảy bơ lạt trên chảo sạch ở lửa nhỏ để bơ không cháy, cho tỏi băm vào phi vàng thơm ngào ngạt.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Hòa 20ml nước mắm và 15g đường đổ vào chảo bơ tỏi đun sôi sủi bọt sánh nhẹ.', tip: 'Dùng lửa nhỏ khi thắng bơ cùng nước mắm đường giúp sốt nhũ tương bóng mượt bám đều mà vẫn giữ giòn da gà.' },
      { stepNumber: 4, instruction: 'Trút cánh gà chiên vào xóc nhanh tay 45 giây cho áo đều bơ tỏi vàng ruộm rồi dọn ngay.' }
    ]
  },
  {
    id: 'v5-nam-25',
    slug: 'dau-hu-chien-sa-ot-chay-nam-bo',
    title: 'Đậu hũ chiên sả ớt giòn rụm chay Nam Bộ',
    description: 'Món chay quốc dân miền Nam với từng miếng đậu hũ chiên vàng ngoài giòn trong béo mềm, phủ đẫm lớp sả băm ớt tươi rang mặn ngọt thơm lừng.',
    cuisine: 'vietnamese',
    category: 'mon_chay',
    region: 'nam',
    cookTimeMinutes: 18,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('dau-phu-sot-ca'),
    nutrition: { calories: 240, proteinG: 17, fatG: 14, carbG: 12 },
    tags: ['Miền Nam', 'Món chay', 'Đậu hũ sả ớt', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'TOFU', name: 'Đậu hũ trắng chắc mịn cắt miếng', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'LEMONGRASS', name: 'Sả non băm thật nhuyễn', requiredQuantity: 4, unit: 'piece' },
      { ingredientId: 'CHILI', name: 'Ớt sừng băm nhỏ', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'SOY_SAUCE', name: 'Nước tương & chút muối đường', requiredQuantity: 25, unit: 'ml' },
      { ingredientId: 'COOKING_OIL', name: 'Dầu thực vật chiên đậu', requiredQuantity: 50, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Khía nhẹ vắt chéo trên lưng miếng đậu hũ để gia vị sả ớt bám sâu, thấm khô rồi chiên vàng giòn các mặt trong 8 phút.', timerMinutes: 8 },
      { stepNumber: 2, instruction: 'Chắt bớt dầu chỉ chừa 15ml trong chảo, cho sả băm và ớt vào xào lửa vừa 3 phút đến khi sả ráo vàng thơm.', timerMinutes: 3 },
      { stepNumber: 3, instruction: 'Nêm nước tương và xíu đường vào sả, trút đậu hũ chiên trở lại đảo đều 2 phút cho sả vàng áo kín miếng đậu.', tip: 'Rang sả thật ráo giòn trước khi nêm nước tương giúp lớp sả tơi bông không bị ướt sũng.', timerMinutes: 2 },
      { stepNumber: 4, instruction: 'Bày ra đĩa ăn nóng với cơm trắng và dưa leo tươi.' }
    ]
  },
  {
    id: 'v5-nam-26',
    slug: 'canh-nam-bi-do-chay-nam-bo',
    title: 'Canh kiểm bí đỏ khoai lang cốt dừa chay Nam Bộ',
    description: 'Món canh chay đặc trưng ngày rằm phương Nam với bí đỏ, khoai lang, nấm mèo hầm mềm quyện vị béo thanh ngọt dịu của nước cốt dừa tươi.',
    cuisine: 'vietnamese',
    category: 'mon_chay',
    region: 'nam',
    cookTimeMinutes: 30,
    servings: 4,
    difficulty: 'easy',
    imageUrl: DISH_IMG('dau-phu-sot-ca'),
    nutrition: { calories: 285, proteinG: 9, fatG: 12, carbG: 37 },
    tags: ['Miền Nam', 'Canh kiểm', 'Món chay', 'Ngày rằm'],
    ingredients: [
      { ingredientId: 'PUMPKIN', name: 'Bí đỏ sáp cắt miếng vuông lớn', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'SWEET_POTATO', name: 'Khoai lang mật cắt khúc vừa', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'TOFU', name: 'Đậu hũ chiên cắt tam giác', requiredQuantity: 2, unit: 'piece' },
      { ingredientId: 'MUSHROOM', name: 'Nấm mèo ngâm nở cắt miếng', requiredQuantity: 40, unit: 'g' },
      { ingredientId: 'COCONUT_MILK', name: 'Nước cốt dừa tươi béo dịu', requiredQuantity: 180, unit: 'ml' },
      { ingredientId: 'SALT', name: 'Muối hột & chút đường phèn thanh', requiredQuantity: 8, unit: 'g' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ngâm sơ khoai lang cắt khúc qua nước muối loãng 5 phút cho sạch nhựa trắng.' },
      { stepNumber: 2, instruction: 'Đun sôi 900ml nước lọc, cho bí đỏ và khoai lang vào hầm lửa vừa 14 phút cho vừa chín dẻo bùi.', timerMinutes: 14 },
      { stepNumber: 3, instruction: 'Thả đậu hũ chiên và nấm mèo vào nấu tiếp 5 phút cùng muối và chút đường phèn.', timerMinutes: 5 },
      { stepNumber: 4, instruction: 'Hạ nhỏ lửa, rót 180ml nước cốt dừa tươi vào khuấy nhẹ vừa sôi lăn tăn là tắt bếp ngay.', tip: 'Cho nước cốt dừa vào cuối cùng và không đun sôi bùng để nước canh sánh mịn không bị tách dầu.' }
    ]
  },
  {
    id: 'v5-nam-27',
    slug: 'com-chien-tom-thit-trung-sai-gon',
    title: 'Cơm chiên tôm thịt trứng tơi vàng Sài Gòn',
    description: 'Đĩa cơm chiên chảo lửa lớn kiểu tiệm ăn Chợ Lớn - Sài Gòn với từng hạt cơm săn giòn áo trứng vàng ươm, tôm hạt lựu đỏ giòn và hành hoa.',
    cuisine: 'vietnamese',
    category: 'mon_nhanh_sang',
    region: 'nam',
    cookTimeMinutes: 15,
    servings: 3,
    difficulty: 'easy',
    imageUrl: DISH_IMG('com-tam-suon'),
    nutrition: { calories: 465, proteinG: 26, fatG: 15, carbG: 56 },
    tags: ['Miền Nam', 'Sài Gòn', 'Cơm chiên', 'Dưới 20 phút'],
    ingredients: [
      { ingredientId: 'RICE', name: 'Cơm nấu khô để lạnh qua đêm tơi hạt', requiredQuantity: 400, unit: 'g' },
      { ingredientId: 'SHRIMP', name: 'Tôm tươi bóc vỏ thái hạt lựu', requiredQuantity: 180, unit: 'g' },
      { ingredientId: 'PORK_LOIN', name: 'Thịt nạc khìa hoặc chả lụa thái hạt lựu', requiredQuantity: 120, unit: 'g' },
      { ingredientId: 'CHICKEN_EGG', name: 'Trứng gà ta tươi', requiredQuantity: 3, unit: 'piece' },
      { ingredientId: 'CARROT', name: 'Cà rốt thái hạt lựu nhỏ chần sơ', requiredQuantity: 1, unit: 'piece' },
      { ingredientId: 'SCALLION', name: 'Hành lá thái nhỏ, tỏi & nước tương', requiredQuantity: 1, unit: 'bunch' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Trộn đều 2 lòng đỏ trứng vào tô cơm nguội để từng hạt cơm bọc lớp áo vàng bóng trước khi lên chảo.', tip: 'Áo lòng đỏ trứng vào cơm nguội trước khi rang giúp hạt cơm tơi khô rời nhau mà không bị ướt nhão.' },
      { stepNumber: 2, instruction: 'Phi thơm tỏi trên chảo gang nóng, xào chín săn tôm hạt lựu, thịt và cà rốt trong 2 phút rồi trút riêng.', timerMinutes: 2 },
      { stepNumber: 3, instruction: 'Cho cơm áo trứng và phần trứng còn lại vào đảo đều tay liên tục trên lửa lớn 6 phút đến khi hạt cơm nhảy tanh tách.', timerMinutes: 6 },
      { stepNumber: 4, instruction: 'Trút nhân tôm thịt và hành lá vào đảo nhanh 1 phút, rưới xíu nước tương sát thành chảo cho dậy mùi thơm khói.' }
    ]
  }
];
