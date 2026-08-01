export const MAX_LOCAL_SEARCH_QUERY_LENGTH = 80;
const MAX_LOCAL_SEARCH_TEXT_LENGTH = 512;

export function normalizeLocalSearchText(value: string, maxLength = MAX_LOCAL_SEARCH_TEXT_LENGTH): string {
  return value
    .slice(0, maxLength)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/giu, "d")
    .toLocaleLowerCase("vi-VN")
    .replace(/\s+/g, " ")
    .trim();
}
