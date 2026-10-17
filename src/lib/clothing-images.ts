/**
 * 의류 이미지 레지스트리.
 * React Native는 require() 경로가 정적이어야 하므로 직접 나열한다.
 * 파일명은 clothing.ts의 id와 동일하다.
 */

export const CLOTHING_IMAGES: Record<string, number> = {
  beanie: require('../../assets/clothing/beanie.png'),
  boots: require('../../assets/clothing/boots.png'),
  cap: require('../../assets/clothing/cap.png'),
  cardigan: require('../../assets/clothing/cardigan.png'),
  coat: require('../../assets/clothing/coat.png'),
  corduroy_pants: require('../../assets/clothing/corduroy_pants.png'),
  dress_shoes: require('../../assets/clothing/dress_shoes.png'),
  flip_flops: require('../../assets/clothing/flip_flops.png'),
  gloves: require('../../assets/clothing/gloves.png'),
  heavy_padding: require('../../assets/clothing/heavy_padding.png'),
  hoodie: require('../../assets/clothing/hoodie.png'),
  jeans: require('../../assets/clothing/jeans.png'),
  knit: require('../../assets/clothing/knit.png'),
  light_jacket: require('../../assets/clothing/light_jacket.png'),
  light_padding: require('../../assets/clothing/light_padding.png'),
  long_pants: require('../../assets/clothing/long_pants.png'),
  long_tee: require('../../assets/clothing/long_tee.png'),
  mask: require('../../assets/clothing/mask.png'),
  padding: require('../../assets/clothing/padding.png'),
  rain_jacket: require('../../assets/clothing/rain_jacket.png'),
  scarf: require('../../assets/clothing/scarf.png'),
  short_tee: require('../../assets/clothing/short_tee.png'),
  shorts: require('../../assets/clothing/shorts.png'),
  sleeveless: require('../../assets/clothing/sleeveless.png'),
  sneakers: require('../../assets/clothing/sneakers.png'),
  sunglasses: require('../../assets/clothing/sunglasses.png'),
  sunscreen: require('../../assets/clothing/sunscreen.png'),
  sweatpants: require('../../assets/clothing/sweatpants.png'),
  sweatshirt: require('../../assets/clothing/sweatshirt.png'),
  thin_knit: require('../../assets/clothing/thin_knit.png'),
  thin_shirt: require('../../assets/clothing/thin_shirt.png'),
  trench_coat: require('../../assets/clothing/trench_coat.png'),
  umbrella: require('../../assets/clothing/umbrella.png'),
};

/** 이미지가 아직 없는 아이템은 undefined — 화면에서 이름만 표시한다 */
export function imageOf(id: string): number | undefined {
  return CLOTHING_IMAGES[id];
}
