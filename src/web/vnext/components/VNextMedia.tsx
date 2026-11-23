import React, { useEffect, useState } from 'react';
import type { BrandDirection } from '../feature';
import type { ResolvedRecipeImage } from '../../lib/recipe-media';
import { resolveImpRecipeId } from '../lib/v4-media-index';

export interface VerifiedDishPhotoMeta {
  assetId: string;
  src: string;
  src640: string;
  altVi: string;
  verifiedIngredientsSummary: string;
}

/**
 * Verified 1:1 Recipe Photo Provenance Registry for all 71 canonical recipes (`ALL_RECIPES`).
 * Every dish has its own unique editorial photograph — zero duplicate photos, zero ingredient icons.
 */
export const VERIFIED_VNEXT_RECIPE_MEDIA: Record<string, VerifiedDishPhotoMeta> = {
  "canh-chua-ca-loc-nam-bo": {
    assetId: "FOOD-VN-CANH-01",
    src: "/takolio/vnext/food/canh-chua-ca-loc-nam-bo.webp",
    src640: "/takolio/vnext/food/canh-chua-ca-loc-nam-bo-640w.webp",
    altVi: "Bát canh chua cá lóc Nam Bộ với dứa, cà chua, đậu bắp, giá đỗ và ngò ôm",
    verifiedIngredientsSummary: "Cá lóc 400g · Cà chua · Dứa · Giá đỗ · Ngò gai & ngò ôm",
  },
  "canh-cua-dong-rau-day-mong-toi": {
    assetId: "FOOD-VN-CANH-02",
    src: "/takolio/vnext/food/canh-cua-dong-rau-day-mong-toi.webp",
    src640: "/takolio/vnext/food/canh-cua-dong-rau-day-mong-toi-640w.webp",
    altVi: "Ảnh thực tế món Canh cua đồng mồng tơi mướp hương bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cua đồng giã nhuyễn lọc lấy nước · Rau đay & mồng tơi · Mướp hương thái vát · Nước mắm truyền thống",
  },
  "canh-kho-qua-nhoi-thit": {
    assetId: "FOOD-VN-CANH-03",
    src: "/takolio/vnext/food/canh-kho-qua-nhoi-thit.webp",
    src640: "/takolio/vnext/food/canh-kho-qua-nhoi-thit-640w.webp",
    altVi: "Ảnh thực tế món Canh khổ qua nhồi thịt thanh mát bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Mướp đắng / Khổ qua xanh · Thịt heo nạc xay · Nấm mèo / Mộc nhĩ ngâm nở · Hành lá & ngò rí",
  },
  "canh-suon-bi-dao": {
    assetId: "FOOD-VN-CANH-04",
    src: "/takolio/vnext/food/canh-suon-bi-dao.webp",
    src640: "/takolio/vnext/food/canh-suon-bi-dao-640w.webp",
    altVi: "Ảnh thực tế món Canh sườn hầm bí đao ngọt thanh bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Sườn non heo chặt miếng vừa · Bí đao gọt vỏ cắt miếng · Hành lá & mùi tàu · Hành khô băm",
  },
  "canh-bi-do-thit-bam": {
    assetId: "FOOD-VN-CANH-05",
    src: "/takolio/vnext/food/canh-bi-do-thit-bam.webp",
    src640: "/takolio/vnext/food/canh-bi-do-thit-bam-640w.webp",
    altVi: "Tô canh bí đỏ thịt bằm hạt sen điểm ngò gai",
    verifiedIngredientsSummary: "Bí đỏ dẻo · Thịt heo bằm · Hạt sen · Ngò gai & hành lá",
  },
  "canh-ngao-nau-chua-thi-la": {
    assetId: "FOOD-VN-CANH-06",
    src: "/takolio/vnext/food/canh-ngao-nau-chua-thi-la.webp",
    src640: "/takolio/vnext/food/canh-ngao-nau-chua-thi-la-640w.webp",
    altVi: "Ảnh thực tế món Canh ngao nấu chua thì là bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Ngao tươi sống / Thịt ngao · Cà chua đỏ chín · Dứa thơm thái mỏng · Hành hoa & thì là tươi",
  },
  "thit-kho-trung": {
    assetId: "FOOD-VN-KHO-01",
    src: "/takolio/vnext/food/thit-kho-trung.webp",
    src640: "/takolio/vnext/food/thit-kho-trung-640w.webp",
    altVi: "Thịt kho tàu nước dừa trứng gà ta óng màu cánh gián trong bát gốm ấm",
    verifiedIngredientsSummary: "Thịt ba chỉ 400g · Trứng gà ta 4 quả · Nước mắm Phú Quốc · Nước dừa",
  },
  "ca-loc-kho-to-tieu-den": {
    assetId: "FOOD-VN-KHO-02",
    src: "/takolio/vnext/food/ca-loc-kho-to-tieu-den.webp",
    src640: "/takolio/vnext/food/ca-loc-kho-to-tieu-den-640w.webp",
    altVi: "Niêu đất cá lóc kho tộ tiêu đen kèm tóp mỡ vàng giòn và hành lá",
    verifiedIngredientsSummary: "Cá lóc cắt khứa 500g · Thịt ba chỉ tóp mỡ · Tiêu đen · Nước mắm",
  },
  "ga-ta-kho-gung-sa": {
    assetId: "FOOD-VN-KHO-03",
    src: "/takolio/vnext/food/ga-ta-kho-gung-sa.webp",
    src640: "/takolio/vnext/food/ga-ta-kho-gung-sa-640w.webp",
    altVi: "Đùi gà ta kho gừng thái sợi và sả băm vàng óng trong thố gốm",
    verifiedIngredientsSummary: "Thịt đùi gà ta 500g · Gừng già thái sợi 40g · Sả tươi · Nước mắm",
  },
  "suon-heo-xao-chua-ngot": {
    assetId: "FOOD-VN-KHO-04",
    src: "/takolio/vnext/food/suon-heo-xao-chua-ngot.webp",
    src640: "/takolio/vnext/food/suon-heo-xao-chua-ngot-640w.webp",
    altVi: "Ảnh thực tế món Sườn heo xào chua ngọt chuẩn vị bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Sườn non heo chặt dẻ nhỏ · Cà chua chín băm nhỏ · Hành tây thái múi cau · Tỏi băm nhuyễn",
  },
  "tom-rim-man-ngot": {
    assetId: "FOOD-VN-KHO-05",
    src: "/takolio/vnext/food/tom-rim-man-ngot.webp",
    src640: "/takolio/vnext/food/tom-rim-man-ngot-640w.webp",
    altVi: "Ảnh thực tế món Tôm rim mặn ngọt mắm đường tỏi ớt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Tôm tươi cắt bớt râu chân · Tỏi & hành khô băm nhỏ · Hành hoa thái nhỏ · Nước mắm truyền thống",
  },
  "thit-ba-chi-kho-cu-cai": {
    assetId: "FOOD-VN-KHO-06",
    src: "/takolio/vnext/food/thit-ba-chi-kho-cu-cai.webp",
    src640: "/takolio/vnext/food/thit-ba-chi-kho-cu-cai-640w.webp",
    altVi: "Ảnh thực tế món Thịt ba chỉ kho củ cải trắng bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt ba chỉ heo · Củ cải trắng (cắt khúc vuông) · Hành tím băm · Nước mắm ngon",
  },
  "rau-muong-xao-toi": {
    assetId: "FOOD-VN-XAO-01",
    src: "/takolio/vnext/food/rau-muong-xao-toi.webp",
    src640: "/takolio/vnext/food/rau-muong-xao-toi-640w.webp",
    altVi: "Đĩa rau muống xào tỏi xanh mướt điểm tép tỏi ta phi vàng",
    verifiedIngredientsSummary: "Rau muống ngọn non 1 bó · Tỏi ta đập dập · Nước mắm",
  },
  "bo-xao-can-toi-hanh-tay": {
    assetId: "FOOD-VN-XAO-02",
    src: "/takolio/vnext/food/bo-xao-can-toi-hanh-tay.webp",
    src640: "/takolio/vnext/food/bo-xao-can-toi-hanh-tay-640w.webp",
    altVi: "Ảnh thực tế món Bò xào cần tỏi hành tây mềm ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt bò thăn thái lát mỏng ngang thớ · Hành tây thái múi cau · Cà chua thái múi · Tỏi khô băm nhỏ",
  },
  "muc-xao-can-toi-dua": {
    assetId: "FOOD-VN-XAO-03",
    src: "/takolio/vnext/food/muc-xao-can-toi-dua.webp",
    src640: "/takolio/vnext/food/muc-xao-can-toi-dua-640w.webp",
    altVi: "Ảnh thực tế món Mực ống xào cần tỏi dứa chua ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Mực ống tươi khứa vảy rồng · Dứa thái lát mỏng · Cà chua chín · Hành tây",
  },
  "thit-bo-xao-bong-cai": {
    assetId: "FOOD-VN-XAO-04",
    src: "/takolio/vnext/food/thit-bo-xao-bong-cai.webp",
    src640: "/takolio/vnext/food/thit-bo-xao-bong-cai-640w.webp",
    altVi: "Ảnh thực tế món Thịt bò xào bông cải xanh cà rốt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt bò mềm thái lát · Bông cải xanh cắt miếng · Cà rốt tỉa hoa thái mỏng · Tỏi băm",
  },
  "su-su-xao-trung-ga": {
    assetId: "FOOD-VN-XAO-05",
    src: "/takolio/vnext/food/su-su-xao-trung-ga.webp",
    src640: "/takolio/vnext/food/su-su-xao-trung-ga-640w.webp",
    altVi: "Ảnh thực tế món Su su xào trứng gà thanh ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Quả su su non bào sợi · Trứng gà · Hành hoa thái nhỏ · Hành tím băm",
  },
  "dau-cove-xao-thit-bo": {
    assetId: "FOOD-VN-XAO-06",
    src: "/takolio/vnext/food/dau-cove-xao-thit-bo.webp",
    src640: "/takolio/vnext/food/dau-cove-xao-thit-bo-640w.webp",
    altVi: "Ảnh thực tế món Đậu cô ve xào thịt bò giòn ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt bò thăn · Đậu cô ve non tước xơ · Tỏi băm thơm · Nước mắm & dầu hào",
  },
  "dau-phu-sot-ca-chua": {
    assetId: "FOOD-VN-CHIEN-01",
    src: "/takolio/vnext/food/dau-phu-sot-ca-chua.webp",
    src640: "/takolio/vnext/food/dau-phu-sot-ca-chua-640w.webp",
    altVi: "Đĩa đậu phụ lướt ván sốt cà chua rắc hành lá tươi",
    verifiedIngredientsSummary: "Đậu phụ trắng chiên vàng · Cà chua chín · Hành hoa · Nước mắm",
  },
  "trung-chien-thit-bam-nam-rom": {
    assetId: "FOOD-VN-CHIEN-02",
    src: "/takolio/vnext/food/trung-chien-thit-bam-nam-rom.webp",
    src640: "/takolio/vnext/food/trung-chien-thit-bam-nam-rom-640w.webp",
    altVi: "Ảnh thực tế món Trứng chiên thịt bằm nấm rơm bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Trứng gà tươi · Thịt heo xay nạc · Nấm rơm hoặc nấm hương băm nhỏ · Hành hoa & hành khô",
  },
  "canh-ga-chien-nuoc-mam": {
    assetId: "FOOD-VN-CHIEN-03",
    src: "/takolio/vnext/food/canh-ga-chien-nuoc-mam.webp",
    src640: "/takolio/vnext/food/canh-ga-chien-nuoc-mam-640w.webp",
    altVi: "Ảnh thực tế món Cánh gà chiên nước mắm tỏi ớt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cánh gà khúc giữa tươi · Tỏi ta băm nhuyễn · Ớt sừng băm · Nước mắm truyền thống",
  },
  "cha-ca-hai-phong": {
    assetId: "FOOD-VN-CHIEN-04",
    src: "/takolio/vnext/food/cha-ca-hai-phong.webp",
    src640: "/takolio/vnext/food/cha-ca-hai-phong-640w.webp",
    altVi: "Ảnh thực tế món Chả cá chiên thì là hạt tiêu bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Phi lê cá tươi quết dẻo · Mỡ heo hạt lựu (tạo độ mọng) · Thì là tươi cắt nhỏ · Hành khô băm",
  },
  "nem-ran-truyen-thong-ha-noi": {
    assetId: "FOOD-VN-CHIEN-05",
    src: "/takolio/vnext/food/nem-ran-truyen-thong-ha-noi.webp",
    src640: "/takolio/vnext/food/nem-ran-truyen-thong-ha-noi-640w.webp",
    altVi: "Ảnh thực tế món Nem rán truyền thống Hà Nội giòn rụm bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt heo vai xay · Tôm tươi băm nhỏ · Lòng đỏ trứng gà · Cà rốt & củ đậu thái chỉ",
  },
  "ca-ro-phi-chien-gion-mam-gung": {
    assetId: "FOOD-VN-CHIEN-06",
    src: "/takolio/vnext/food/ca-ro-phi-chien-gion-mam-gung.webp",
    src640: "/takolio/vnext/food/ca-ro-phi-chien-gion-mam-gung-640w.webp",
    altVi: "Ảnh thực tế món Cá rô phi chiên giòn chấm mắm gừng bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cá rô phi tươi nguyên con khía sâu · Gừng tươi giã nhuyễn · Tỏi & ớt băm · Chanh vắt lấy nước cốt",
  },
  "ga-ta-hap-la-chanh": {
    assetId: "FOOD-VN-HAP-01",
    src: "/takolio/vnext/food/ga-ta-hap-la-chanh.webp",
    src640: "/takolio/vnext/food/ga-ta-hap-la-chanh-640w.webp",
    altVi: "Ảnh thực tế món Gà ta hấp lá chanh da giòn thịt ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Gà ta nửa con hoặc đùi gà tươi · Gừng đập dập & hành củ · Lá chanh tươi bánh tẻ thái chỉ · Ớt tươi cắt lát",
  },
  "thit-ba-chi-luoc-mam-tom": {
    assetId: "FOOD-VN-HAP-02",
    src: "/takolio/vnext/food/thit-ba-chi-luoc-mam-tom.webp",
    src640: "/takolio/vnext/food/thit-ba-chi-luoc-mam-tom-640w.webp",
    altVi: "Ảnh thực tế món Thịt ba chỉ luộc chấm mắm tôm cà pháo bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt ba chỉ rút sườn liền khổ · Hành khô đập dập · Gừng đập dập · Nước mắm chấm hoặc mắm tôm",
  },
  "ca-dieu-hong-hap-hanh-gung": {
    assetId: "FOOD-VN-HAP-03",
    src: "/takolio/vnext/food/ca-dieu-hong-hap-hanh-gung.webp",
    src640: "/takolio/vnext/food/ca-dieu-hong-hap-hanh-gung-640w.webp",
    altVi: "Ảnh thực tế món Cá điêu hồng hấp hành gừng xì dầu bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cá điêu hồng tươi nguyên con · Gừng non cạo vỏ thái sợi dài · Hành hoa chẻ sợi mảnh · Xì dầu hảo hạng & dầu hào",
  },
  "rau-cu-luoc-kho-quet": {
    assetId: "FOOD-VN-HAP-04",
    src: "/takolio/vnext/food/rau-cu-luoc-kho-quet.webp",
    src640: "/takolio/vnext/food/rau-cu-luoc-kho-quet-640w.webp",
    altVi: "Ảnh thực tế món Rau củ luộc thập cẩm kho quẹt tóp mỡ bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Súp lơ xanh cắt miếng · Cà rốt cắt khúc · Quả su su cắt con chì · Thịt ba chỉ thái hạt lựu (làm tóp mỡ)",
  },
  "muc-hap-gung-sa": {
    assetId: "FOOD-VN-HAP-05",
    src: "/takolio/vnext/food/muc-hap-gung-sa.webp",
    src640: "/takolio/vnext/food/muc-hap-gung-sa-640w.webp",
    altVi: "Ảnh thực tế món Mực ống hấp gừng sả giòn ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Mực ống tươi nguyên con · Gừng non thái chỉ · Sả tươi đập dập cắt khúc · Ớt sừng thái vát",
  },
  "tom-hap-nuoc-dua-tuoi": {
    assetId: "FOOD-VN-HAP-06",
    src: "/takolio/vnext/food/tom-hap-nuoc-dua-tuoi.webp",
    src640: "/takolio/vnext/food/tom-hap-nuoc-dua-tuoi-640w.webp",
    altVi: "Ảnh thực tế món Tôm hấp nước dừa tươi ngọt lịm bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Tôm sú hoặc tôm càng tươi sống · Sả cây đập dập · Chanh & muối tiêu hạt",
  },
  "goi-cuon-tom-thit-nam-bo": {
    assetId: "FOOD-VN-CUON-01",
    src: "/takolio/vnext/food/goi-cuon-tom-thit-nam-bo.webp",
    src640: "/takolio/vnext/food/goi-cuon-tom-thit-nam-bo-640w.webp",
    altVi: "Ảnh thực tế món Gỏi cuốn tôm thịt chấm tương phộng bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Tôm sú tươi luộc bóc vỏ chẻ đôi · Thịt ba chỉ luộc thái mỏng · Bún tươi sợi nhỏ · Bánh tráng dẻo cuốn gỏi",
  },
  "pho-cuon-bo-ha-noi": {
    assetId: "FOOD-VN-CUON-02",
    src: "/takolio/vnext/food/pho-cuon-bo-ha-noi.webp",
    src640: "/takolio/vnext/food/pho-cuon-bo-ha-noi-640w.webp",
    altVi: "Ảnh thực tế món Phở cuốn bò xào rau thơm Hà Nội bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt bò thăn thái lát mỏng · Bánh phở vuông cán phẳng · Tỏi băm thơm · Rau húng Láng & xà lách",
  },
  "nom-hoa-chuoi-tai-heo": {
    assetId: "FOOD-VN-CUON-03",
    src: "/takolio/vnext/food/nom-hoa-chuoi-tai-heo.webp",
    src640: "/takolio/vnext/food/nom-hoa-chuoi-tai-heo-640w.webp",
    altVi: "Ảnh thực tế món Nộm hoa chuối tai heo giòn sần sật bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Tai heo làm sạch luộc chín giòn · Cà rốt nạo sợi · Giá đỗ sống nhặt sạch · Chanh tươi vắt nước cốt",
  },
  "goi-ga-xe-phay-bap-cai": {
    assetId: "FOOD-VN-CUON-04",
    src: "/takolio/vnext/food/goi-ga-xe-phay-bap-cai.webp",
    src640: "/takolio/vnext/food/goi-ga-xe-phay-bap-cai-640w.webp",
    altVi: "Đĩa gỏi gà xé phay trộn bắp cải hành tây rau răm hành phi",
    verifiedIngredientsSummary: "Thịt gà luộc xé phay · Bắp cải bào · Hành tây · Rau răm & chanh ớt",
  },
  "nom-du-du-bo-kho": {
    assetId: "FOOD-VN-CUON-05",
    src: "/takolio/vnext/food/nom-du-du-bo-kho.webp",
    src640: "/takolio/vnext/food/nom-du-du-bo-kho-640w.webp",
    altVi: "Ảnh thực tế món Nộm đu đủ bò khô phố cổ Hà Nội bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Đu đủ xanh & cà rốt nạo sợi · Thịt bò khô xé sợi / gan bò tẩm vị · Rau kinh giới & rau húng bạc hà · Nước mắm pha giấm đường tỏi ớt",
  },
  "nem-lui-hue-nuong-sa": {
    assetId: "FOOD-VN-CUON-06",
    src: "/takolio/vnext/food/nem-lui-hue-nuong-sa.webp",
    src640: "/takolio/vnext/food/nem-lui-hue-nuong-sa-640w.webp",
    altVi: "Ảnh thực tế món Nem lụi nướng sả cuốn bánh tráng bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt heo xay có mỡ dẻo · Cây sả tươi làm que lụi · Hành tím & tỏi băm nhuyễn · Nước mắm ngon & mật ong",
  },
  "pho-bo-tai-lan-ha-noi": {
    assetId: "FOOD-VN-BUN-01",
    src: "/takolio/vnext/food/pho-bo-tai-lan-ha-noi.webp",
    src640: "/takolio/vnext/food/pho-bo-tai-lan-ha-noi-640w.webp",
    altVi: "Bát phở bò tái lăn Hà Nội nước dùng trong với hành tây, hành hoa và chanh tươi",
    verifiedIngredientsSummary: "Thịt bò thăn 400g · Bánh phở tươi 500g · Gừng nướng & hồi quế",
  },
  "bun-cha-ha-noi-than-hoa": {
    assetId: "FOOD-VN-BUN-02",
    src: "/takolio/vnext/food/bun-cha-ha-noi-than-hoa.webp",
    src640: "/takolio/vnext/food/bun-cha-ha-noi-than-hoa-640w.webp",
    altVi: "Mẹt bún chả nướng than hoa Hà Nội kèm nước chấm đu đủ và rau sống",
    verifiedIngredientsSummary: "Chả viên & thịt ba chỉ nướng · Bún rối · Đu đủ xanh · Rau thơm",
  },
  "bun-bo-hue-chuan-vi": {
    assetId: "FOOD-VN-BUN-03",
    src: "/takolio/vnext/food/bun-bo-hue-chuan-vi.webp",
    src640: "/takolio/vnext/food/bun-bo-hue-chuan-vi-640w.webp",
    altVi: "Ảnh thực tế món Bún bò xứ Huế giò heo chả cua sả ớt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Bắp bò hoa luộc thái lát · Giò heo / xương ống ninh nước dùng · Bún sợi to cọng tròn Huế · Sả cây đập dập bó lọn",
  },
  "bun-rieu-cua-dong": {
    assetId: "FOOD-VN-BUN-04",
    src: "/takolio/vnext/food/bun-rieu-cua-dong.webp",
    src640: "/takolio/vnext/food/bun-rieu-cua-dong-640w.webp",
    altVi: "Ảnh thực tế món Bún riêu cua đồng bắp bò giấm bỗng bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cua đồng xay lọc lấy nước riêu · Đậu phụ rán vàng giòn · Cà chua bổ múi cau · Thịt bò tái chần mềm",
  },
  "bun-thit-nuong-nam-bo": {
    assetId: "FOOD-VN-BUN-05",
    src: "/takolio/vnext/food/bun-thit-nuong-nam-bo.webp",
    src640: "/takolio/vnext/food/bun-thit-nuong-nam-bo-640w.webp",
    altVi: "Ảnh thực tế món Bún thịt nướng Nam Bộ chả giò mỡ hành bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt ba rọi / nạc dăm ướp nướng · Bún tươi · Hành lá làm mỡ hành · Dưa leo băm & xà lách rau thơm",
  },
  "mien-ga-nam-huong": {
    assetId: "FOOD-VN-BUN-06",
    src: "/takolio/vnext/food/mien-ga-nam-huong.webp",
    src640: "/takolio/vnext/food/mien-ga-nam-huong-640w.webp",
    altVi: "Ảnh thực tế món Miến gà nấm hương mộc nhĩ thanh tao bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt gà luộc xé miếng · Miến dong làng So ngâm mềm · Nấm hương rừng ngâm nở · Hành hoa & rau răm thái nhỏ",
  },
  "dau-phu-kho-nam-dong-co": {
    assetId: "FOOD-VN-CHAY-01",
    src: "/takolio/vnext/food/dau-phu-kho-nam-dong-co.webp",
    src640: "/takolio/vnext/food/dau-phu-kho-nam-dong-co-640w.webp",
    altVi: "Ảnh thực tế món Đậu phụ kho nấm đông cô tiêu đen bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Đậu phụ cắt miếng chiên vàng · Nấm đông cô / nấm đùi gà · Nước tương ngon & dầu hào chay · Ớt tươi & tiêu đen đập dập",
  },
  "canh-nam-hat-sen-tao-do": {
    assetId: "FOOD-VN-CHAY-02",
    src: "/takolio/vnext/food/canh-nam-hat-sen-tao-do.webp",
    src640: "/takolio/vnext/food/canh-nam-hat-sen-tao-do-640w.webp",
    altVi: "Ảnh thực tế món Canh nấm hạt sen táo đỏ thanh lọc bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Nấm đùi gà & nấm kim châm · Cà rốt tỉa hoa · Bắp ngọt & củ sen thái lát · Mùi tàu & boa-rô",
  },
  "mi-xao-chay-rau-nam": {
    assetId: "FOOD-VN-CHAY-03",
    src: "/takolio/vnext/food/mi-xao-chay-rau-nam.webp",
    src640: "/takolio/vnext/food/mi-xao-chay-rau-nam-640w.webp",
    altVi: "Ảnh thực tế món Mì xào giòn chay nấm rau củ bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Mì sợi vàng / mì gói chần sơ · Nấm đùi gà thái lát mỏng · Cà rốt thái sợi · Cải ngọt / bắp cải",
  },
  "ca-tim-nuong-mo-hanh": {
    assetId: "FOOD-VN-CHAY-04",
    src: "/takolio/vnext/food/ca-tim-nuong-mo-hanh.webp",
    src640: "/takolio/vnext/food/ca-tim-nuong-mo-hanh-640w.webp",
    altVi: "Ảnh thực tế món Cà tím nướng mỡ hành nước tương tỏi ớt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cà tím dài quả thẳng · Hành hoa thái nhỏ · Ớt tươi băm nhuyễn · Tỏi băm nhỏ",
  },
  "dau-hu-non-sot-nam-rom": {
    assetId: "FOOD-VN-CHAY-05",
    src: "/takolio/vnext/food/dau-hu-non-sot-nam-rom.webp",
    src640: "/takolio/vnext/food/dau-hu-non-sot-nam-rom-640w.webp",
    altVi: "Ảnh thực tế món Đậu hũ non sốt nấm rơm dầu hào bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Đậu hũ non cây cắt khoanh tròn · Nấm rơm tươi cắt đôi · Hành hoa & ngò rí · Dầu hào chay & xì dầu",
  },
  "canh-cai-nau-dau-phu-non": {
    assetId: "FOOD-VN-CHAY-06",
    src: "/takolio/vnext/food/canh-cai-nau-dau-phu-non.webp",
    src640: "/takolio/vnext/food/canh-cai-nau-dau-phu-non-640w.webp",
    altVi: "Ảnh thực tế món Canh cải xanh gừng đậu phụ thanh mát bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Rau cải bẹ xanh cắt khúc · Đậu phụ trắng cắt miếng vuông · Gừng già đập dập thơm cay · Muối hột & hạt nêm chay",
  },
  "com-chien-trung-toi-hanh-hoa": {
    assetId: "FOOD-VN-SANG-01",
    src: "/takolio/vnext/food/com-chien-trung-toi-hanh-hoa.webp",
    src640: "/takolio/vnext/food/com-chien-trung-toi-hanh-hoa-640w.webp",
    altVi: "Tô cơm chiên trứng tỏi phi vàng giòn rắc hành hoa tươi trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cơm nguội hạt tơi · Trứng gà ta · Tỏi phi vàng · Hành hoa",
  },
  "banh-mi-op-la-pate": {
    assetId: "FOOD-VN-SANG-02",
    src: "/takolio/vnext/food/banh-mi-op-la-pate.webp",
    src640: "/takolio/vnext/food/banh-mi-op-la-pate-640w.webp",
    altVi: "Ảnh thực tế món Bánh mì ốp la pate dưa leo bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Trứng gà ốp la lòng đào · Dưa leo thái lát mỏng · Rau mùi tươi · Xì dầu & tương ớt",
  },
  "chao-thit-bam-gung-tia-to": {
    assetId: "FOOD-VN-SANG-03",
    src: "/takolio/vnext/food/chao-thit-bam-gung-tia-to.webp",
    src640: "/takolio/vnext/food/chao-thit-bam-gung-tia-to-640w.webp",
    altVi: "Ảnh thực tế món Cháo thịt bằm gừng tía tô giải cảm bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Gạo tẻ trộn chút nếp rang vàng · Thịt heo nạc băm nhỏ · Gừng già thái chỉ · Hành hoa & lá tía tô thái sợi",
  },
  "mi-tom-xao-bo-trung-long-dao": {
    assetId: "FOOD-VN-SANG-04",
    src: "/takolio/vnext/food/mi-tom-xao-bo-trung-long-dao.webp",
    src640: "/takolio/vnext/food/mi-tom-xao-bo-trung-long-dao-640w.webp",
    altVi: "Ảnh thực tế món Mì gói xào bò trứng lòng đào bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Gói mì ăn liền hảo hạng · Thịt bò thăn thái mỏng · Trứng gà ốp la · Rau cải ngọt / rau muống",
  },
  "trung-cuon-rau-cu-han-quoc": {
    assetId: "FOOD-VN-SANG-05",
    src: "/takolio/vnext/food/trung-cuon-rau-cu-han-quoc.webp",
    src640: "/takolio/vnext/food/trung-cuon-rau-cu-han-quoc-640w.webp",
    altVi: "Ảnh thực tế món Trứng cuộn rau củ mềm mịn bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Trứng gà tươi · Cà rốt băm hạt lựu nhỏ li ti · Hành lá băm nhỏ · Sữa tươi không đường (làm mềm trứng)",
  },
  "sup-ga-ngo-non-nam-huong": {
    assetId: "FOOD-VN-SANG-06",
    src: "/takolio/vnext/food/sup-ga-ngo-non-nam-huong.webp",
    src640: "/takolio/vnext/food/sup-ga-ngo-non-nam-huong-640w.webp",
    altVi: "Tô súp gà ngô non nấm hương trứng hoa rắc hành ngò",
    verifiedIngredientsSummary: "Ức gà xé sợi · Ngô non · Nấm hương · Trứng gà ta đánh vân",
  },
  "lau-rieu-cua-dong-bap-bo-suon-sun": {
    assetId: "FOOD-VN-LAU-01",
    src: "/takolio/vnext/food/lau-rieu-cua-dong-bap-bo-suon-sun.webp",
    src640: "/takolio/vnext/food/lau-rieu-cua-dong-bap-bo-suon-sun-640w.webp",
    altVi: "Ảnh thực tế món Lẩu riêu cua đồng sườn sụn bắp bò bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cua đồng tươi giã nhuyễn lọc lấy riêu · Bắp bò hoa thái lát mỏng nhúng lẩu · Sườn sụn heo chần sơ chặt nhỏ · Đậu phụ rán giòn phồng",
  },
  "lau-ga-la-giang-chua-cay": {
    assetId: "FOOD-VN-LAU-02",
    src: "/takolio/vnext/food/lau-ga-la-giang-chua-cay.webp",
    src640: "/takolio/vnext/food/lau-ga-la-giang-chua-cay-640w.webp",
    altVi: "Ảnh thực tế món Lẩu gà ta lá giang chua cay Nam Bộ bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Gà ta nguyên con chặt miếng · Sả tươi đập dập & tỏi băm · Ớt hiểm đập dập · Ngò gai & ngò ôm",
  },
  "lau-hai-san-thap-cam-chua-cay": {
    assetId: "FOOD-VN-LAU-03",
    src: "/takolio/vnext/food/lau-hai-san-thap-cam-chua-cay.webp",
    src640: "/takolio/vnext/food/lau-hai-san-thap-cam-chua-cay-640w.webp",
    altVi: "Ảnh thực tế món Lẩu hải sản tôm mực chua cay bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Tôm sú tươi sống · Mực ống khía vảy rồng cắt khoanh · Phi lê cá tươi thái lát · Nấm kim châm & nấm đùi gà",
  },
  "lau-nam-thap-cam-thanh-dam": {
    assetId: "FOOD-VN-LAU-04",
    src: "/takolio/vnext/food/lau-nam-thap-cam-thanh-dam.webp",
    src640: "/takolio/vnext/food/lau-nam-thap-cam-thanh-dam-640w.webp",
    altVi: "Ảnh thực tế món Lẩu nấm thập cẩm gà ta thanh đạm bổ dưỡng bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Gà ta thả vườn chặt miếng nhỏ · Thập cẩm nấm (đùi gà, kim châm, hương) · Cà rốt & bắp ngọt · Đậu phụ non thái lát",
  },
  "lau-ca-thac-lac-kho-qua": {
    assetId: "FOOD-VN-LAU-05",
    src: "/takolio/vnext/food/lau-ca-thac-lac-kho-qua.webp",
    src640: "/takolio/vnext/food/lau-ca-thac-lac-kho-qua-640w.webp",
    altVi: "Ảnh thực tế món Lẩu cá thác lác khổ qua thanh mát bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cá thác lác nạo quết dẻo · Khổ qua bào mỏng ướp đá lạnh · Hành hoa & thì là thái nhỏ · Nước mắm ngon & tiêu sọ trắng",
  },
  "pasta-pomodoro": {
    assetId: "FOOD-GL-01",
    src: "/takolio/vnext/food/pasta-pomodoro.webp",
    src640: "/takolio/vnext/food/pasta-pomodoro-640w.webp",
    altVi: "Ảnh thực tế món Mì Ý sốt cà chua Pomodoro bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Mì Ý · Cà chua · Tỏi · Dầu olive / Dầu ăn",
  },
  "mapo-tofu": {
    assetId: "FOOD-GL-02",
    src: "/takolio/vnext/food/mapo-tofu.webp",
    src640: "/takolio/vnext/food/mapo-tofu-640w.webp",
    altVi: "Ảnh thực tế món Đậu phụ sốt Mapo Tofu Tứ Xuyên bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Đậu phụ · Thịt heo xay · Tỏi · Gừng",
  },
  "tomato-egg-stir-fry": {
    assetId: "FOOD-GL-03",
    src: "/takolio/vnext/food/tomato-egg-stir-fry.webp",
    src640: "/takolio/vnext/food/tomato-egg-stir-fry-640w.webp",
    altVi: "Ảnh thực tế món Cà chua xào trứng Trung Hoa bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Trứng gà · Cà chua · Hành lá · Dầu ăn",
  },
  oyakodon: {
    assetId: "FOOD-GL-04",
    src: "/takolio/vnext/food/oyakodon.webp",
    src640: "/takolio/vnext/food/oyakodon-640w.webp",
    altVi: "Ảnh thực tế món Cơm gà trứng Oyakodon Nhật Bản bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt đùi gà · Trứng gà · Hành tây · Nước tương",
  },
  "kimchi-fried-rice": {
    assetId: "FOOD-GL-05",
    src: "/takolio/vnext/food/kimchi-fried-rice.webp",
    src640: "/takolio/vnext/food/kimchi-fried-rice-640w.webp",
    altVi: "Ảnh thực tế món Cơm chiên kim chi Hàn Quốc bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cơm nguội · Kim chi · Trứng gà · Dầu ăn",
  },
  "pad-krapow": {
    assetId: "FOOD-GL-06",
    src: "/takolio/vnext/food/pad-krapow.webp",
    src640: "/takolio/vnext/food/pad-krapow-640w.webp",
    altVi: "Ảnh thực tế món Thịt băm xào lá quế kiểu Thái (Pad Krapow) bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt heo xay · Ớt · Tỏi · Nước mắm",
  },
  "kimbap-han-quoc": {
    assetId: "FOOD-GL-07",
    src: "/takolio/vnext/food/kimbap-han-quoc.webp",
    src640: "/takolio/vnext/food/kimbap-han-quoc-640w.webp",
    altVi: "Ảnh thực tế món Cơm cuộn Kimbap Hàn Quốc bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Cơm trắng · Trứng gà · Cà rốt · Dưa leo",
  },
  "tokbokki-cay-ngot": {
    assetId: "FOOD-GL-08",
    src: "/takolio/vnext/food/tokbokki-cay-ngot.webp",
    src640: "/takolio/vnext/food/tokbokki-cay-ngot-640w.webp",
    altVi: "Ảnh thực tế món Bánh gạo Tokbokki sốt cay ngọt bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Bánh gạo / Bột gạo · Trứng gà · Bắp cải · Hành lá",
  },
  chawanmushi: {
    assetId: "FOOD-GL-09",
    src: "/takolio/vnext/food/chawanmushi.webp",
    src640: "/takolio/vnext/food/chawanmushi-640w.webp",
    altVi: "Chén sứ trứng hấp Chawanmushi Nhật Bản kèm tôm và nấm hương",
    verifiedIngredientsSummary: "Trứng gà mịn · Nước dùng thanh · Tôm tươi · Nấm hương",
  },
  "thai-green-curry": {
    assetId: "FOOD-GL-10",
    src: "/takolio/vnext/food/thai-green-curry.webp",
    src640: "/takolio/vnext/food/thai-green-curry-640w.webp",
    altVi: "Ảnh thực tế món Cà ri gà kiểu Thái (Green Curry) bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Thịt đùi gà · Sữa tươi/Cốt dừa · Ớt xanh/đỏ · Tỏi",
  },
  "spaghetti-bolognese": {
    assetId: "FOOD-GL-11",
    src: "/takolio/vnext/food/spaghetti-bolognese.webp",
    src640: "/takolio/vnext/food/spaghetti-bolognese-640w.webp",
    altVi: "Ảnh thực tế món Mì Ý sốt bò băm Bolognese bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Mì Ý Spaghetti · Thịt bò/heo băm · Cà chua · Hành tây",
  },
  "chinese-tomato-egg": {
    assetId: "FOOD-GL-12",
    src: "/takolio/vnext/food/chinese-tomato-egg.webp",
    src640: "/takolio/vnext/food/chinese-tomato-egg-640w.webp",
    altVi: "Ảnh thực tế món Trứng xào cà chua kiểu Trung Hoa bày trên bàn gỗ ấm",
    verifiedIngredientsSummary: "Trứng gà · Cà chua · Hành lá · Dầu ăn",
  },
};

/**
 * Verified 1:1 Simple Food Photo Registry for all 9 canonical T20 simple foods (`SIMPLE_FOODS`).
 * Kept separate from `VERIFIED_VNEXT_RECIPE_MEDIA` so `ALL_RECIPES` slug contract tests stay strict.
 */
export const VERIFIED_SIMPLE_FOOD_MEDIA: Record<string, VerifiedDishPhotoMeta> = {
  "sf-steamed-rice": {
    assetId: "FOOD-SF-01",
    src: "/takolio/vnext/food/sf-steamed-rice.webp",
    src640: "/takolio/vnext/food/sf-steamed-rice-640w.webp",
    altVi: "Bát cơm trắng gạo tám thơm nóng dẻo trên mâm gỗ gia đình",
    verifiedIngredientsSummary: "Gạo trắng nấu chín dẻo thơm",
  },
  "sf-boiled-egg": {
    assetId: "FOOD-SF-02",
    src: "/takolio/vnext/food/sf-boiled-egg.webp",
    src640: "/takolio/vnext/food/sf-boiled-egg-640w.webp",
    altVi: "Đĩa trứng gà luộc chín bổ đôi rắc tiêu đen trên đĩa gốm",
    verifiedIngredientsSummary: "Trứng gà luộc chín tới",
  },
  "sf-sliced-cucumber": {
    assetId: "FOOD-SF-03",
    src: "/takolio/vnext/food/sf-sliced-cucumber.webp",
    src640: "/takolio/vnext/food/sf-sliced-cucumber-640w.webp",
    altVi: "Đĩa dưa leo tươi thái lát giòn mát ăn kèm bữa cơm",
    verifiedIngredientsSummary: "Dưa leo tươi rửa sạch thái lát",
  },
  "sf-boiled-water-spinach": {
    assetId: "FOOD-SF-04",
    src: "/takolio/vnext/food/sf-boiled-water-spinach.webp",
    src640: "/takolio/vnext/food/sf-boiled-water-spinach-640w.webp",
    altVi: "Đĩa rau muống luộc xanh giòn kèm chén nước mắm tỏi ớt",
    verifiedIngredientsSummary: "Rau muống non luộc chín tới",
  },
  "sf-steamed-broccoli": {
    assetId: "FOOD-SF-05",
    src: "/takolio/vnext/food/sf-steamed-broccoli.webp",
    src640: "/takolio/vnext/food/sf-steamed-broccoli-640w.webp",
    altVi: "Tô bông cải xanh hấp chín tới giữ trọn màu xanh tươi",
    verifiedIngredientsSummary: "Bông cải xanh hấp mềm giòn",
  },
  "sf-fresh-milk": {
    assetId: "FOOD-SF-06",
    src: "/takolio/vnext/food/sf-fresh-milk.webp",
    src640: "/takolio/vnext/food/sf-fresh-milk-640w.webp",
    altVi: "Ly sữa tươi trắng mịn giàu dinh dưỡng trên bàn gỗ sáng",
    verifiedIngredientsSummary: "Sữa tươi tiệt trùng mát lành",
  },
  "sf-bread": {
    assetId: "FOOD-SF-07",
    src: "/takolio/vnext/food/sf-bread.webp",
    src640: "/takolio/vnext/food/sf-bread-640w.webp",
    altVi: "Ổ bánh mì Việt Nam vỏ vàng giòn rụm mới ra lò",
    verifiedIngredientsSummary: "Bánh mì vỏ giòn ruột xốp",
  },
  "sf-seasonal-fruit": {
    assetId: "FOOD-SF-08",
    src: "/takolio/vnext/food/sf-seasonal-fruit.webp",
    src640: "/takolio/vnext/food/sf-seasonal-fruit-640w.webp",
    altVi: "Đĩa trái cây tươi theo mùa gồm xoài chín, dưa hấu, thanh long và ổi",
    verifiedIngredientsSummary: "Trái cây tươi tráng miệng theo mùa",
  },
  "sf-yogurt": {
    assetId: "FOOD-SF-09",
    src: "/takolio/vnext/food/sf-yogurt.webp",
    src640: "/takolio/vnext/food/sf-yogurt-640w.webp",
    altVi: "Hũ sữa chua trắng mịn dẻo thơm mát lành tráng miệng",
    verifiedIngredientsSummary: "Sữa chua lên men tự nhiên",
  },
};

export const VERIFIED_RECIPE_ID_TO_SLUG: Readonly<Record<string, string>> = {
  "vn-canh-01": "canh-chua-ca-loc-nam-bo",
  "vn-canh-02": "canh-cua-dong-rau-day-mong-toi",
  "vn-canh-03": "canh-kho-qua-nhoi-thit",
  "vn-canh-04": "canh-suon-bi-dao",
  "vn-canh-05": "canh-bi-do-thit-bam",
  "vn-canh-06": "canh-ngao-nau-chua-thi-la",
  "vn-kho-01": "thit-kho-trung",
  "vn-kho-02": "ca-loc-kho-to-tieu-den",
  "vn-kho-03": "ga-ta-kho-gung-sa",
  "vn-kho-04": "suon-heo-xao-chua-ngot",
  "vn-kho-05": "tom-rim-man-ngot",
  "vn-kho-06": "thit-ba-chi-kho-cu-cai",
  "vn-xao-01": "rau-muong-xao-toi",
  "vn-xao-02": "bo-xao-can-toi-hanh-tay",
  "vn-xao-03": "muc-xao-can-toi-dua",
  "vn-xao-04": "thit-bo-xao-bong-cai",
  "vn-xao-05": "su-su-xao-trung-ga",
  "vn-xao-06": "dau-cove-xao-thit-bo",
  "vn-chien-01": "dau-phu-sot-ca-chua",
  "vn-chien-02": "trung-chien-thit-bam-nam-rom",
  "vn-chien-03": "canh-ga-chien-nuoc-mam",
  "vn-chien-04": "cha-ca-hai-phong",
  "vn-chien-05": "nem-ran-truyen-thong-ha-noi",
  "vn-chien-06": "ca-ro-phi-chien-gion-mam-gung",
  "vn-hap-01": "ga-ta-hap-la-chanh",
  "vn-hap-02": "thit-ba-chi-luoc-mam-tom",
  "vn-hap-03": "ca-dieu-hong-hap-hanh-gung",
  "vn-hap-04": "rau-cu-luoc-kho-quet",
  "vn-hap-05": "muc-hap-gung-sa",
  "vn-hap-06": "tom-hap-nuoc-dua-tuoi",
  "vn-cuon-01": "goi-cuon-tom-thit-nam-bo",
  "vn-cuon-02": "pho-cuon-bo-ha-noi",
  "vn-cuon-03": "nom-hoa-chuoi-tai-heo",
  "vn-cuon-04": "goi-ga-xe-phay-bap-cai",
  "vn-cuon-05": "nom-du-du-bo-kho",
  "vn-cuon-06": "nem-lui-hue-nuong-sa",
  "vn-bun-01": "pho-bo-tai-lan-ha-noi",
  "vn-bun-02": "bun-cha-ha-noi-than-hoa",
  "vn-bun-03": "bun-bo-hue-chuan-vi",
  "vn-bun-04": "bun-rieu-cua-dong",
  "vn-bun-05": "bun-thit-nuong-nam-bo",
  "vn-bun-06": "mien-ga-nam-huong",
  "vn-chay-01": "dau-phu-kho-nam-dong-co",
  "vn-chay-02": "canh-nam-hat-sen-tao-do",
  "vn-chay-03": "mi-xao-chay-rau-nam",
  "vn-chay-04": "ca-tim-nuong-mo-hanh",
  "vn-chay-05": "dau-hu-non-sot-nam-rom",
  "vn-chay-06": "canh-cai-nau-dau-phu-non",
  "vn-sang-01": "com-chien-trung-toi-hanh-hoa",
  "vn-sang-02": "banh-mi-op-la-pate",
  "vn-sang-03": "chao-thit-bam-gung-tia-to",
  "vn-sang-04": "mi-tom-xao-bo-trung-long-dao",
  "vn-sang-05": "trung-cuon-rau-cu-han-quoc",
  "vn-sang-06": "sup-ga-ngo-non-nam-huong",
  "vn-lau-01": "lau-rieu-cua-dong-bap-bo-suon-sun",
  "vn-lau-02": "lau-ga-la-giang-chua-cay",
  "vn-lau-03": "lau-hai-san-thap-cam-chua-cay",
  "vn-lau-04": "lau-nam-thap-cam-thanh-dam",
  "vn-lau-05": "lau-ca-thac-lac-kho-qua",
  "gl-01": "pasta-pomodoro",
  "gl-02": "mapo-tofu",
  "gl-03": "tomato-egg-stir-fry",
  "gl-04": "oyakodon",
  "gl-05": "kimchi-fried-rice",
  "gl-06": "pad-krapow",
  "gl-07": "kimbap-han-quoc",
  "gl-08": "tokbokki-cay-ngot",
  "gl-09": "chawanmushi",
  "gl-10": "thai-green-curry",
  "gl-11": "spaghetti-bolognese",
  "gl-12": "chinese-tomato-egg",
  "sf-steamed-rice": "sf-steamed-rice",
  "sf-boiled-egg": "sf-boiled-egg",
  "sf-sliced-cucumber": "sf-sliced-cucumber",
  "sf-boiled-water-spinach": "sf-boiled-water-spinach",
  "sf-steamed-broccoli": "sf-steamed-broccoli",
  "sf-fresh-milk": "sf-fresh-milk",
  "sf-bread": "sf-bread",
  "sf-seasonal-fruit": "sf-seasonal-fruit",
  "sf-yogurt": "sf-yogurt",
};

const NORMALIZED_TITLE_TO_SLUG: Readonly<Record<string, string>> = {
  "banh-gao-tokbokki-sot-cay-ngot": "tokbokki-cay-ngot",
  "banh-mi": "sf-bread",
  "banh-mi-op-la-pate-dua-leo": "banh-mi-op-la-pate",
  "bo-xao-can-toi-hanh-tay-mem-ngot": "bo-xao-can-toi-hanh-tay",
  "boiled-egg": "sf-boiled-egg",
  "boiled-water-spinach": "sf-boiled-water-spinach",
  "bong-cai-xanh-hap": "sf-steamed-broccoli",
  "bread": "sf-bread",
  "bun-bo-xu-hue-gio-heo": "bun-bo-hue-chuan-vi",
  "bun-bo-xu-hue-gio-heo-cha-cua-sa-ot": "bun-bo-hue-chuan-vi",
  "bun-cha-nuong-than-hoa-ha-noi": "bun-cha-ha-noi-than-hoa",
  "bun-rieu-cua-dong-bap-bo-giam-bong": "bun-rieu-cua-dong",
  "bun-rieu-cua-dong-giam-bong": "bun-rieu-cua-dong",
  "bun-thit-nuong-nam-bo-cha-gio-mo-hanh": "bun-thit-nuong-nam-bo",
  "ca-chua-xao-trung-trung-hoa": "tomato-egg-stir-fry",
  "ca-dieu-hong-hap-hanh-gung-xi-dau": "ca-dieu-hong-hap-hanh-gung",
  "ca-loc-kho-to-tieu-den-cay-nong": "ca-loc-kho-to-tieu-den",
  "ca-ri-ga-kieu-thai-green-curry": "thai-green-curry",
  "ca-ro-phi-chien-gion-cham-mam-gung": "ca-ro-phi-chien-gion-mam-gung",
  "ca-tim-nuong-mo-hanh-nuoc-tuong-toi-ot": "ca-tim-nuong-mo-hanh",
  "canh-bi-do-thit-bam-hat-sen": "canh-bi-do-thit-bam",
  "canh-cai-xanh-gung-dau-phu": "canh-cai-nau-dau-phu-non",
  "canh-cai-xanh-gung-dau-phu-thanh-mat": "canh-cai-nau-dau-phu-non",
  "canh-cua-dong-mong-toi-muop-huong": "canh-cua-dong-rau-day-mong-toi",
  "canh-ga-chien-nuoc-mam-toi-ot": "canh-ga-chien-nuoc-mam",
  "canh-kho-qua-nhoi-thit-thanh-mat": "canh-kho-qua-nhoi-thit",
  "canh-nam-hat-sen-tao-do-thanh-loc": "canh-nam-hat-sen-tao-do",
  "canh-suon-ham-bi-dao": "canh-suon-bi-dao",
  "canh-suon-ham-bi-dao-ngot-thanh": "canh-suon-bi-dao",
  "cha-ca-chien-thi-la-hat-tieu": "cha-ca-hai-phong",
  "chao-thit-bam-gung-tia-to-giai-cam": "chao-thit-bam-gung-tia-to",
  "com-chien-kim-chi-han-quoc": "kimchi-fried-rice",
  "com-chien-trung-vang-gion": "com-chien-trung-toi-hanh-hoa",
  "com-chien-trung-vang-gion-toi-phi": "com-chien-trung-toi-hanh-hoa",
  "com-cuon-kimbap-han-quoc": "kimbap-han-quoc",
  "com-ga-trung-oyakodon-nhat-ban": "oyakodon",
  "com-trang": "sf-steamed-rice",
  "dau-co-ve-xao-thit-bo": "dau-cove-xao-thit-bo",
  "dau-co-ve-xao-thit-bo-gion-ngot": "dau-cove-xao-thit-bo",
  "dau-hu-non-sot-nam-rom-dau-hao": "dau-hu-non-sot-nam-rom",
  "dau-phu-kho-nam-dong-co-tieu-den": "dau-phu-kho-nam-dong-co",
  "dau-phu-luot-van-sot-ca-chua": "dau-phu-sot-ca-chua",
  "dau-phu-sot-mapo-tofu-tu-xuyen": "mapo-tofu",
  "dua-leo-thai-lat": "sf-sliced-cucumber",
  "fresh-milk": "sf-fresh-milk",
  "ga-ta-hap-la-chanh-da-gion": "ga-ta-hap-la-chanh",
  "ga-ta-hap-la-chanh-da-gion-thit-ngot": "ga-ta-hap-la-chanh",
  "ga-ta-kho-gung-sa-dam-da": "ga-ta-kho-gung-sa",
  "goi-cuon-tom-thit-cham-tuong-phong": "goi-cuon-tom-thit-nam-bo",
  "goi-ga-xe-phay-bap-cai-hanh-tay": "goi-ga-xe-phay-bap-cai",
  "lau-ca-thac-lac-kho-qua-thanh-mat": "lau-ca-thac-lac-kho-qua",
  "lau-ga-ta-la-giang-chua-cay": "lau-ga-la-giang-chua-cay",
  "lau-ga-ta-la-giang-chua-cay-nam-bo": "lau-ga-la-giang-chua-cay",
  "lau-hai-san-chua-cay": "lau-hai-san-thap-cam-chua-cay",
  "lau-hai-san-tom-muc-chua-cay": "lau-hai-san-thap-cam-chua-cay",
  "lau-nam-thap-cam-ga-ta": "lau-nam-thap-cam-thanh-dam",
  "lau-nam-thap-cam-ga-ta-thanh-dam-bo-duong": "lau-nam-thap-cam-thanh-dam",
  "lau-rieu-cua-dong-suon-sun-bap-bo": "lau-rieu-cua-dong-bap-bo-suon-sun",
  "mi-goi-xao-bo-trung-long-dao": "mi-tom-xao-bo-trung-long-dao",
  "mi-xao-gion-chay-nam-rau-cu": "mi-xao-chay-rau-nam",
  "mi-y-sot-bo-bam-bolognese": "spaghetti-bolognese",
  "mi-y-sot-ca-chua-pomodoro": "pasta-pomodoro",
  "mien-ga-nam-huong-moc-nhi-thanh-tao": "mien-ga-nam-huong",
  "muc-ong-hap-gung-sa": "muc-hap-gung-sa",
  "muc-ong-hap-gung-sa-gion-ngot": "muc-hap-gung-sa",
  "muc-ong-xao-can-toi-dua": "muc-xao-can-toi-dua",
  "muc-ong-xao-can-toi-dua-chua-ngot": "muc-xao-can-toi-dua",
  "nem-lui-nuong-sa": "nem-lui-hue-nuong-sa",
  "nem-lui-nuong-sa-cuon-banh-trang": "nem-lui-hue-nuong-sa",
  "nem-ran-truyen-thong-ha-noi-gion-rum": "nem-ran-truyen-thong-ha-noi",
  "nom-du-du-bo-kho-pho-co-ha-noi": "nom-du-du-bo-kho",
  "nom-hoa-chuoi-tai-heo-gion-san-sat": "nom-hoa-chuoi-tai-heo",
  "pho-bo-tai-lan-ha-noi-nuoc-dung-trong-vat": "pho-bo-tai-lan-ha-noi",
  "pho-cuon-bo-xao-rau-thom-ha-noi": "pho-cuon-bo-ha-noi",
  "rau-cu-luoc-thap-cam-kho-quet": "rau-cu-luoc-kho-quet",
  "rau-cu-luoc-thap-cam-kho-quet-top-mo": "rau-cu-luoc-kho-quet",
  "rau-muong-luoc": "sf-boiled-water-spinach",
  "rau-muong-xao-toi-xanh-gion": "rau-muong-xao-toi",
  "seasonal-fruit": "sf-seasonal-fruit",
  "sliced-cucumber": "sf-sliced-cucumber",
  "steamed-broccoli": "sf-steamed-broccoli",
  "steamed-rice": "sf-steamed-rice",
  "su-su-xao-trung-ga-thanh-ngot": "su-su-xao-trung-ga",
  "sua-chua": "sf-yogurt",
  "sua-tuoi": "sf-fresh-milk",
  "suon-heo-xao-chua-ngot-chuan-vi": "suon-heo-xao-chua-ngot",
  "sup-ga-ngo-non-nam-huong-trung-hoa": "sup-ga-ngo-non-nam-huong",
  "thit-ba-chi-kho-cu-cai-trang": "thit-ba-chi-kho-cu-cai",
  "thit-ba-chi-luoc-cham-mam-tom-ca-phao": "thit-ba-chi-luoc-mam-tom",
  "thit-ba-chi-luoc-mam-tom-ca-phao": "thit-ba-chi-luoc-mam-tom",
  "thit-bam-xao-la-que-kieu-thai-pad-krapow": "pad-krapow",
  "thit-bo-xao-bong-cai-xanh": "thit-bo-xao-bong-cai",
  "thit-bo-xao-bong-cai-xanh-ca-rot": "thit-bo-xao-bong-cai",
  "thit-kho-tau-nuoc-dua-trung": "thit-kho-trung",
  "thit-kho-tau-nuoc-dua-trung-beo-ngay": "thit-kho-trung",
  "thit-kho-tau-nuoc-dua-trung-cut": "thit-kho-trung",
  "tom-hap-nuoc-dua-tuoi-ngot-lim": "tom-hap-nuoc-dua-tuoi",
  "tom-rim-man-ngot-mam-duong-toi-ot": "tom-rim-man-ngot",
  "trai-cay-theo-mua": "sf-seasonal-fruit",
  "trung-cuon-rau-cu-mem-min": "trung-cuon-rau-cu-han-quoc",
  "trung-hap-chawanmushi-nhat-ban": "chawanmushi",
  "trung-luoc": "sf-boiled-egg",
  "trung-xao-ca-chua-kieu-trung-hoa": "chinese-tomato-egg",
  "yogurt": "sf-yogurt",
};

export function slugifyCulinaryTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hasVerifiedDishMedia(key: string): boolean {
  return Boolean(VERIFIED_VNEXT_RECIPE_MEDIA[key] || VERIFIED_SIMPLE_FOOD_MEDIA[key]);
}

/**
 * Resolves the canonical dish media key from `(recipeId, slug, title)` across all 71 canonical
 * recipes and 9 simple foods, even when planner/home/favorites DTOs omit `slug` or pass `id`.
 */
export function resolveCanonicalDishSlug(
  recipeId?: string | null,
  slug?: string | null,
  title?: string | null,
): string {
  const trimmedId = recipeId?.trim() ?? '';
  if (trimmedId) {
    if (VERIFIED_RECIPE_ID_TO_SLUG[trimmedId]) {
      return VERIFIED_RECIPE_ID_TO_SLUG[trimmedId]!;
    }
    if (hasVerifiedDishMedia(trimmedId)) {
      return trimmedId;
    }
  }

  const trimmedSlug = slug?.trim() ?? '';
  if (trimmedSlug) {
    if (VERIFIED_RECIPE_ID_TO_SLUG[trimmedSlug]) {
      return VERIFIED_RECIPE_ID_TO_SLUG[trimmedSlug]!;
    }
    if (hasVerifiedDishMedia(trimmedSlug)) {
      return trimmedSlug;
    }
  }

  if (title) {
    const normalizedTitle = slugifyCulinaryTitle(title);
    if (NORMALIZED_TITLE_TO_SLUG[normalizedTitle]) {
      return NORMALIZED_TITLE_TO_SLUG[normalizedTitle]!;
    }
    if (hasVerifiedDishMedia(normalizedTitle)) {
      return normalizedTitle;
    }
    if (
      trimmedSlug &&
      !trimmedSlug.startsWith('vn-') &&
      !trimmedSlug.startsWith('gl-') &&
      !trimmedSlug.startsWith('imp-') &&
      !trimmedSlug.startsWith('rec_') &&
      !trimmedSlug.startsWith('sf-')
    ) {
      return trimmedSlug;
    }
    return normalizedTitle;
  }

  if (
    trimmedSlug &&
    !trimmedSlug.startsWith('vn-') &&
    !trimmedSlug.startsWith('gl-') &&
    !trimmedSlug.startsWith('imp-') &&
    !trimmedSlug.startsWith('rec_') &&
    !trimmedSlug.startsWith('sf-')
  ) {
    return trimmedSlug;
  }

  return '';
}

export type MascotPose =
  | 'welcome'
  | 'guide'
  | 'fridge'
  | 'scanning'
  | 'empty-fridge'
  | 'cooking'
  | 'shopping'
  | 'achievement'
  | 'offline'
  | 'error'
  | 'vector';

const MASCOT_POSE_MAP: Record<MascotPose, { base: string; vnextBase: string; alt: string }> = {
  welcome: {
    base: '/takolio/brand-v2/mascot/bemam-01-welcome',
    vnextBase: '/takolio/vnext/mascot/pose-01-welcome',
    alt: 'Bé Mầm Bếp — Mascot Takolio đội mũ đầu bếp mầm xanh, quàng khăn coral vẫy tay chào',
  },
  guide: {
    base: '/takolio/brand-v2/mascot/bemam-03-fridge',
    vnextBase: '/takolio/vnext/mascot/pose-02-guide',
    alt: 'Bé Mầm Bếp — Mascot Takolio đồng hành kiểm kê tủ lạnh và gợi ý thực đơn',
  },
  fridge: {
    base: '/takolio/brand-v2/mascot/bemam-03-fridge',
    vnextBase: '/takolio/vnext/mascot/pose-02-guide',
    alt: 'Bé Mầm Bếp — Mascot Takolio đứng cạnh tủ lạnh mở đầy rau củ tươi ngon',
  },
  scanning: {
    base: '/takolio/brand-v2/mascot/bemam-02-scanning',
    vnextBase: '/takolio/vnext/mascot/pose-03-scanning',
    alt: 'Bé Mầm Bếp — Mascot Takolio cầm máy ảnh xanh lá quét nhận diện nguyên liệu bằng AI',
  },
  'empty-fridge': {
    base: '/takolio/brand-v2/mascot/bemam-07-empty-fridge',
    vnextBase: '/takolio/vnext/mascot/pose-04-empty-fridge',
    alt: 'Bé Mầm Bếp — Mascot Takolio bên ngăn tủ lạnh sạch sẽ đang chờ thêm nguyên liệu',
  },
  cooking: {
    base: '/takolio/brand-v2/mascot/bemam-04-cooking',
    vnextBase: '/takolio/vnext/mascot/pose-05-cooking',
    alt: 'Bé Mầm Bếp — Mascot Takolio cầm muỗng gỗ nấu ăn từng bước bên nồi súp nghi ngút khói',
  },
  shopping: {
    base: '/takolio/brand-v2/mascot/bemam-05-shopping',
    vnextBase: '/takolio/brand-v2/mascot/bemam-05-shopping',
    alt: 'Bé Mầm Bếp — Mascot Takolio xách giỏ rau củ tươi cùng danh sách mua sắm thông minh',
  },
  achievement: {
    base: '/takolio/brand-v2/mascot/bemam-06-achievement',
    vnextBase: '/takolio/vnext/mascot/pose-06-achievement',
    alt: 'Bé Mầm Bếp — Mascot Takolio ôm huy hiệu tích xanh hoàn thành bữa ăn ngon đủ dinh dưỡng',
  },
  offline: {
    base: '/takolio/brand-v2/mascot/bemam-08-offline-care',
    vnextBase: '/takolio/vnext/mascot/pose-07-offline',
    alt: 'Bé Mầm Bếp — Mascot Takolio cầm muỗng gỗ giữ an toàn dữ liệu bếp khi ngoại tuyến',
  },
  error: {
    base: '/takolio/brand-v2/mascot/bemam-08-offline-care',
    vnextBase: '/takolio/vnext/mascot/pose-08-error',
    alt: 'Bé Mầm Bếp — Mascot Takolio nhẹ nhàng hỗ trợ khôi phục kết nối bếp',
  },
  vector: {
    base: '/takolio/brand-v2/mascot/bemam-01-welcome',
    vnextBase: '/takolio/vnext/mascot/pose-01-welcome',
    alt: 'Bé Mầm Bếp — Mascot chính thức của Takolio',
  },
};

export const BEMAM_MASCOT_SHOWCASE: ReadonlyArray<{
  pose: MascotPose;
  title: string;
  subtitle: string;
}> = [
  { pose: 'welcome', title: 'Chào hỏi', subtitle: 'Đồng hành' },
  { pose: 'scanning', title: 'Quét nguyên liệu', subtitle: 'Nhận diện bằng AI' },
  { pose: 'fridge', title: 'Kiểm kê tủ lạnh', subtitle: 'Theo dõi hạn dùng' },
  { pose: 'cooking', title: 'Nấu ăn', subtitle: 'Nấu từng bước' },
  { pose: 'shopping', title: 'Mua sắm', subtitle: 'Tạo danh sách thông minh' },
  { pose: 'achievement', title: 'Hoàn thành', subtitle: 'Ăn ngon, đủ dinh dưỡng' },
];

export type BrandFeatureIconKey =
  | 'fridge'
  | 'scan'
  | 'recipes'
  | 'planner'
  | 'shopping'
  | 'cooking';

export const BRAND_FEATURE_ICONS: Record<
  BrandFeatureIconKey,
  { src: string; src128: string; label: string; tint: 'mint' | 'coral' }
> = {
  fridge: {
    src: '/takolio/brand-v2/icons/feature-fridge.webp',
    src128: '/takolio/brand-v2/icons/feature-fridge-128w.webp',
    label: 'Quản lý tủ lạnh',
    tint: 'mint',
  },
  scan: {
    src: '/takolio/brand-v2/icons/feature-scan.webp',
    src128: '/takolio/brand-v2/icons/feature-scan-128w.webp',
    label: 'Quét nguyên liệu AI',
    tint: 'mint',
  },
  recipes: {
    src: '/takolio/brand-v2/icons/feature-recipes.webp',
    src128: '/takolio/brand-v2/icons/feature-recipes-128w.webp',
    label: 'Gợi ý món ăn',
    tint: 'coral',
  },
  planner: {
    src: '/takolio/brand-v2/icons/feature-planner.webp',
    src128: '/takolio/brand-v2/icons/feature-planner-128w.webp',
    label: 'Lên thực đơn 7 ngày',
    tint: 'mint',
  },
  shopping: {
    src: '/takolio/brand-v2/icons/feature-shopping.webp',
    src128: '/takolio/brand-v2/icons/feature-shopping-128w.webp',
    label: 'Danh sách mua sắm',
    tint: 'mint',
  },
  cooking: {
    src: '/takolio/brand-v2/icons/feature-cooking.webp',
    src128: '/takolio/brand-v2/icons/feature-cooking-128w.webp',
    label: 'Nấu ăn từng bước',
    tint: 'coral',
  },
};

/**
 * Official Takolio Brand Lockup (Rule 5b: AI-generated 3D Leaf Green Pot + Sprout raster mark + Nunito ExtraBold wordmark).
 */
export const BrandLockup: React.FC<{
  direction?: BrandDirection;
  compact?: boolean;
  showTagline?: boolean;
  className?: string;
}> = ({ compact = false, showTagline = false, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`} translate="no">
    <img
      src="/takolio/brand-v2/brand/takolio-logo-mark-128.webp"
      srcSet="/takolio/brand-v2/brand/takolio-logo-mark-128.webp 128w, /takolio/brand-v2/brand/takolio-logo-mark.webp 256w"
      sizes={compact ? '36px' : '42px'}
      alt="Takolio"
      width={compact ? 36 : 42}
      height={compact ? 36 : 42}
      className={compact ? 'w-9 h-9 rounded-xl shrink-0 object-contain' : 'w-10 h-10 rounded-xl shrink-0 object-contain'}
    />
    {!compact && (
      <span className="inline-flex flex-col min-w-0">
        <span className="tkv-heading text-[22px] font-black leading-none tracking-tight text-[var(--tkv-ink)] whitespace-nowrap">
          Takolio
        </span>
        {showTagline && (
          <span
            translate="yes"
            className="mt-1 text-[10.5px] font-semibold leading-snug tracking-normal text-[var(--tkv-ink-secondary)] truncate"
          >
            Trợ lý bếp gia đình thông minh với AI
          </span>
        )}
      </span>
    )}
  </span>
);

/**
 * AI-generated 3D-Clay Brand Feature Icon Tile (Rule 5b: zero hand-coded brand feature SVGs).
 */
export const BrandFeatureIcon: React.FC<{
  name: BrandFeatureIconKey;
  size?: number;
  decorative?: boolean;
  className?: string;
}> = ({ name, size = 48, decorative = true, className = '' }) => {
  const meta = BRAND_FEATURE_ICONS[name];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${
        meta.tint === 'coral'
          ? 'bg-[var(--tkv-surface-coral)] border-[var(--tkv-border-coral)]'
          : 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)]'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={meta.src128}
        srcSet={`${meta.src128} 128w, ${meta.src} 256w`}
        sizes={`${size}px`}
        alt={decorative ? '' : meta.label}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        loading="lazy"
        className="w-full h-full object-cover select-none"
      />
    </span>
  );
};

/**
 * Official Bé Mầm Bếp AI-Generated Raster Mascot Illustration (Rule 5b: 100% raster WebP, zero SVG).
 */
export const MascotIllustration: React.FC<{
  pose: MascotPose;
  size?: number;
  decorative?: boolean;
  priority?: boolean;
  motion?: 'none' | 'idle' | 'cheer' | 'scan';
  className?: string;
}> = ({ pose, size = 128, decorative = false, priority = false, motion = 'none', className = '' }) => {
  const [useFallbackPath, setUseFallbackPath] = useState(false);
  const meta = MASCOT_POSE_MAP[pose] ?? MASCOT_POSE_MAP.welcome;
  const activeBase = useFallbackPath ? meta.base : meta.vnextBase;
  const motionClass =
    motion === 'idle'
      ? 'tkv-mascot-float'
      : motion === 'cheer'
        ? 'tkv-mascot-cheer'
        : motion === 'scan'
          ? 'tkv-mascot-float'
          : '';

  const imgEl = (
    <img
      src={`${activeBase}-256w.webp`}
      srcSet={`${activeBase}-256w.webp 256w, ${activeBase}.webp 512w`}
      sizes={`${size}px`}
      alt={decorative ? '' : meta.alt}
      title={decorative ? undefined : 'Bé Mầm Bếp — Mascot Takolio'}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        if (!useFallbackPath) setUseFallbackPath(true);
      }}
      className={`aspect-square rounded-2xl object-contain select-none ${motionClass} ${className}`}
    />
  );

  if (motion === 'scan') {
    return (
      <span className="relative inline-flex items-center justify-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] tkv-scan-aura"
        />
        <span className="relative z-10 inline-flex">{imgEl}</span>
      </span>
    );
  }

  return imgEl;
};

/**
 * Decorative Culinary Rolling Hills Banner (Rule 5b: AI-generated raster illustration matching board.jpg).
 */
export const CulinaryHillsBanner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`relative w-full overflow-hidden rounded-3xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-bg)] ${className}`}
  >
    <img
      src="/takolio/brand-v2/decor/culinary-hills-strip-640w.webp"
      srcSet="/takolio/brand-v2/decor/culinary-hills-strip-640w.webp 640w, /takolio/brand-v2/decor/culinary-hills-strip.webp 1376w"
      sizes="(max-width: 768px) 100vw, 1200px"
      alt="Hoạ tiết mầm xanh, nồi cam đỏ, tô súp nghệ, thớt gỗ và cà chua tươi trên đồi xanh Takolio"
      loading="lazy"
      className="w-full h-[160px] sm:h-[240px] object-cover object-center select-none"
    />
  </div>
);

function isTrustedCanonicalR2Photo(url: string | null | undefined): url is string {
  return Boolean(url && url.startsWith('/api/v1/recipe-media/'));
}

export const VerifiedDishImage: React.FC<{
  slug?: string | null;
  recipeId?: string | null;
  title: string;
  canonicalFallbackSrc?: ResolvedRecipeImage | string | null;
  fallbackSeed?: number;
  aspectClass?: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}> = ({
  slug,
  recipeId,
  title,
  canonicalFallbackSrc,
  aspectClass = 'aspect-[4/3]',
  priority = false,
  className = '',
}) => {
  const [r2Errored, setR2Errored] = useState(false);
  const [localErrored, setLocalErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setR2Errored(false);
    setLocalErrored(false);
    setLoaded(false);
  }, [recipeId, slug, title, canonicalFallbackSrc]);

  const canonicalSlug = resolveCanonicalDishSlug(recipeId, slug, title);
  const vnextEntry = canonicalSlug
    ? (VERIFIED_VNEXT_RECIPE_MEDIA[canonicalSlug] ?? VERIFIED_SIMPLE_FOOD_MEDIA[canonicalSlug])
    : undefined;
  const impRecipeId = !vnextEntry
    ? resolveImpRecipeId(recipeId, slug, title ? slugifyCulinaryTitle(title) : null)
    : null;

  const explicitR2Url =
    typeof canonicalFallbackSrc === 'object' &&
    canonicalFallbackSrc !== null &&
    canonicalFallbackSrc.source === 'canonical_r2' &&
    isTrustedCanonicalR2Photo(canonicalFallbackSrc.src)
      ? canonicalFallbackSrc.src
      : typeof canonicalFallbackSrc === 'string' && isTrustedCanonicalR2Photo(canonicalFallbackSrc)
        ? canonicalFallbackSrc
        : null;
  const r2Url = explicitR2Url ?? (impRecipeId ? `/api/v1/recipe-media/${impRecipeId}/hero/1` : null);

  const imgRevealClass = `w-full h-full object-cover transition-[opacity,transform] duration-300 ease-out group-hover:scale-[1.03] ${
    loaded ? 'opacity-100 scale-100' : 'opacity-90 scale-[1.015]'
  }`;

  // Tier 1: Canonical R2 versioned hero photo (`/api/v1/recipe-media/*`)
  if (!r2Errored && r2Url) {
    return (
      <div className={`relative overflow-hidden bg-[var(--tkv-surface-subtle)] ${aspectClass} ${className}`}>
        {!loaded && <span aria-hidden="true" className="absolute inset-0 tkv-shimmer pointer-events-none" />}
        <img
          src={r2Url}
          alt={`Món ${title}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setR2Errored(true)}
          className={imgRevealClass}
        />
      </div>
    );
  }

  // Tier 2: Verified 1:1 local dish photograph (`VERIFIED_VNEXT_RECIPE_MEDIA` / `VERIFIED_SIMPLE_FOOD_MEDIA`)
  if (!localErrored && vnextEntry) {
    const hasDistinctSrcSet = vnextEntry.src640 !== vnextEntry.src;
    return (
      <div className={`relative overflow-hidden bg-[var(--tkv-surface-subtle)] ${aspectClass} ${className}`}>
        {!loaded && <span aria-hidden="true" className="absolute inset-0 tkv-shimmer pointer-events-none" />}
        <img
          src={vnextEntry.src640}
          srcSet={hasDistinctSrcSet ? `${vnextEntry.src640} 640w, ${vnextEntry.src} 1200w` : undefined}
          sizes={hasDistinctSrcSet ? '(max-width: 768px) 100vw, 560px' : undefined}
          alt={vnextEntry.altVi}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLocalErrored(true)}
          className={imgRevealClass}
        />
      </div>
    );
  }

  // Tier 3: Neutral ceramic placeholder only for unphotographed custom entries (never raw ingredient icons or wrong-dish photos)
  return (
    <div className={`relative overflow-hidden bg-[var(--tkv-surface-subtle)] ${aspectClass} ${className}`}>
      <img
        src="/takolio/vnext/brand/dish-fallback.svg"
        alt={`Món ${title}`}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover select-none"
      />
    </div>
  );
};
