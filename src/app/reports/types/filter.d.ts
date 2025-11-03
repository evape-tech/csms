export type FilterType = 'text' | 'select' | 'multi-select' | 'range';

export interface FilterField {
  id: string;
  label: string;
  type: FilterType;
  options?: string[];           // select / multi-select
  minField?: string;            // range
  maxField?: string;            // range
}