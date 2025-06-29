export interface Categoria {
  id: number;
  nome: string;
  descricao?: string;
  created_at: string;
}

export interface ItemDetalhes {
  local?: string;
  tamanho?: string;
  [key: string]: any;
}

export interface CatalogoItem {
  id: number;
  nome: string;
  categoria_id: number;
  preco: number;
  descricao?: string;
  detalhes?: ItemDetalhes;
  created_at: string;
  updated_at?: string;
  imagem_base64: string;
  catalogo_categorias: Categoria;
}

export interface CartItem extends CatalogoItem {
  quantity: number;
}

export interface CompanySettings {
    id: number;
    nome_empresa?: string;
    logo_url?: string;
    capa_url?: string;
    endereco?: string;
    whatsapp?: string;
    instagram?: string;
}

// Manually created Supabase schema types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      catalogo_categorias: {
        Row: Categoria;
        Insert: Omit<Categoria, 'id' | 'created_at'>;
        Update: Partial<Omit<Categoria, 'id' | 'created_at'>>;
      }
      catalogo_itens: {
        Row: CatalogoItem;
        Insert: Omit<CatalogoItem, 'id' | 'created_at' | 'updated_at' | 'catalogo_categorias'> & { categoria_id: number; };
        Update: Partial<Omit<CatalogoItem, 'id' | 'created_at' | 'updated_at' | 'catalogo_categorias'>>;
      }
      configuracoes_empresa: {
        Row: CompanySettings,
        Insert: Omit<CompanySettings, 'id'>,
        Update: Partial<Omit<CompanySettings, 'id'>>,
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}
