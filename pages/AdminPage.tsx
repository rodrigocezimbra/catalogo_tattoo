import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { CatalogoItem, Categoria, CompanySettings } from '../types';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, EditIcon, TrashIcon, LogoutIcon, SpinnerIcon } from '../components/Icons';

type AdminSection = 'tattoos' | 'categories' | 'settings' | 'bulk-upload';

// --- Reusable Modal ---
const AdminModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-brand-gold-400">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

// --- Main Admin Page ---
const AdminPage: React.FC = () => {
    const [activeSection, setActiveSection] = useState<AdminSection>('tattoos');
    const { settings } = useApp();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'tattoos': return <TattooManagement />;
            case 'categories': return <CategoryManagement />;
            case 'settings': return <SettingsManagement />;
            case 'bulk-upload': return <BulkUpload />;
            default: return <TattooManagement />;
        }
    };
    
    const NavLink: React.FC<{ section: AdminSection; children: React.ReactNode; }> = ({ section, children }) => (
        <button
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === section ? 'bg-brand-gold-500 text-brand-dark' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div>
                    <h1 className="text-4xl font-cinzel text-white">Painel Administrativo</h1>
                    <p className="text-gray-400">Gerencie o conteúdo do site {settings?.nome_empresa}.</p>
                </div>
                <button onClick={handleLogout} className="mt-4 md:mt-0 flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition-colors">
                    <LogoutIcon />
                    <span>Sair</span>
                </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-900 rounded-lg mb-8">
                <NavLink section="tattoos">Gerenciar Tatuagens</NavLink>
                <NavLink section="categories">Gerenciar Categorias</NavLink>
                <NavLink section="settings">Configurações</NavLink>
                <NavLink section="bulk-upload">Upload em Massa</NavLink>
            </div>

            <div className="bg-gray-900/50 p-6 rounded-lg shadow-lg">
                {renderSection()}
            </div>
        </div>
    );
};

// --- Sub-components for each section ---

const TattooManagement = () => {
    const [items, setItems] = useState<CatalogoItem[]>([]);
    const [categories, setCategories] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<CatalogoItem> | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);

        let cats = categories;
        if (cats.length === 0) {
            const { data: cData, error: cError } = await supabase.from('catalogo_categorias').select('*');
            if (cError) {
                alert(`Error fetching categories: ${cError.message}`);
                setLoading(false);
                return;
            }
            cats = cData || [];
            setCategories(cats);
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data: itemsData, error: itemsError, count } = await supabase
            .from('catalogo_itens')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (itemsError) {
            alert(`Error fetching items: ${itemsError.message}`);
        } else if (itemsData) {
            const itemsWithCategories = itemsData.map(item => {
                const category = cats.find(cat => cat.id === item.categoria_id);
                return {
                    ...item,
                    catalogo_categorias: category || { id: 0, nome: 'Sem Categoria', created_at: new Date().toISOString() }
                };
            });
            setItems(itemsWithCategories as CatalogoItem[]);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [page, categories]);

    useEffect(() => {
        fetchData();
    }, [page, fetchData]);

    const handleSave = async (itemData: Partial<CatalogoItem>, imageFile?: File) => {
        let imagem_base64 = itemData.imagem_base64;

        if (imageFile) {
            imagem_base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(imageFile);
            });
        }
        
        const dataToSave = {
            nome: itemData.nome!,
            categoria_id: Number(itemData.categoria_id!),
            preco: Number(itemData.preco!),
            descricao: itemData.descricao,
            detalhes: itemData.detalhes,
            imagem_base64: imagem_base64!,
        };

        const { error } = itemData.id ?
            await supabase.from('catalogo_itens').update(dataToSave).eq('id', itemData.id)
            : await supabase.from('catalogo_itens').insert(dataToSave);
        
        if (error) {
            alert(`Erro ao salvar tatuagem: ${error.message}`);
        } else {
            fetchData();
        }
        setModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if(window.confirm('Tem certeza que deseja excluir esta tatuagem?')){
            const { error } = await supabase.from('catalogo_itens').delete().eq('id', id);
            if (error) {
                alert(`Erro ao excluir tatuagem: ${error.message}`);
            } else {
                if (items.length === 1 && page > 1) {
                    setPage(p => p - 1);
                } else {
                    fetchData();
                }
            }
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Tatuagens</h2>
                <button onClick={() => { setCurrentItem({}); setModalOpen(true); }} className="flex items-center space-x-2 bg-brand-gold-500 text-brand-dark px-4 py-2 rounded-md hover:bg-brand-gold-600 transition-colors">
                    <PlusIcon />
                    <span>Nova Tattoo</span>
                </button>
            </div>
            {loading ? <div className="flex justify-center p-8"><SpinnerIcon className="mx-auto text-brand-gold-500"/></div> : (
            <>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nome</th>
                                <th scope="col" className="px-6 py-3">Categoria</th>
                                <th scope="col" className="px-6 py-3">Preço</th>
                                <th scope="col" className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                        {items.map(item => (
                            <tr key={item.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                                <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{item.nome}</td>
                                <td className="px-6 py-4">{item.catalogo_categorias?.nome}</td>
                                <td className="px-6 py-4">R$ {item.preco.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => { setCurrentItem(item); setModalOpen(true); }} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-400"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                 <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-400">
                        Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)} a {Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
                    </span>
                    <div className="space-x-2">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1 || loading}
                            className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50 hover:bg-gray-600 transition-colors"
                        >
                            Anterior
                        </button>
                        <button 
                            onClick={() => setPage(p => p + 1)} 
                            disabled={page * PAGE_SIZE >= totalCount || loading}
                            className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50 hover:bg-gray-600 transition-colors"
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            </>
            )}
            <AdminModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={currentItem?.id ? 'Editar Tatuagem' : 'Nova Tatuagem'}>
                <TattooForm item={currentItem} categories={categories} onSave={handleSave} onCancel={() => setModalOpen(false)} />
            </AdminModal>
        </div>
    )
};

const TattooForm: React.FC<{item: Partial<CatalogoItem> | null, categories: Categoria[], onSave: (data: Partial<CatalogoItem>, imageFile?: File) => void, onCancel: () => void}> = ({ item, categories, onSave, onCancel }) => {
    const [formData, setFormData] = useState(item || {});
    const [imageFile, setImageFile] = useState<File | undefined>();

    useEffect(() => {
        setFormData(item || {});
    }, [item]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'local' || name === 'tamanho') {
            setFormData(prev => ({...prev, detalhes: {...prev.detalhes, [name]: value}}));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData, imageFile);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} placeholder="Nome da Tattoo" required className="w-full bg-gray-800 p-2 rounded"/>
            <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} required className="w-full bg-gray-800 p-2 rounded">
                <option value="">Selecione a Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input type="number" step="0.01" name="preco" value={formData.preco || ''} onChange={handleChange} placeholder="Preço" required className="w-full bg-gray-800 p-2 rounded"/>
            <textarea name="descricao" value={formData.descricao || ''} onChange={handleChange} placeholder="Descrição" className="w-full bg-gray-800 p-2 rounded"/>
            <input type="text" name="local" value={formData.detalhes?.local || ''} onChange={handleChange} placeholder="Local do corpo (ex: Braço)" className="w-full bg-gray-800 p-2 rounded"/>
            <input type="text" name="tamanho" value={formData.detalhes?.tamanho || ''} onChange={handleChange} placeholder="Tamanho (ex: Médio)" className="w-full bg-gray-800 p-2 rounded"/>
            <label className="block">Imagem</label>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0])} className="w-full bg-gray-800 p-2 rounded"/>
            {formData.imagem_base64 && !imageFile && <img src={formData.imagem_base64} alt="preview" className="w-32 h-32 object-cover rounded"/>}
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-gold-500 text-brand-dark rounded">Salvar</button>
            </div>
        </form>
    )
};

const CategoryManagement = () => {
    const [categories, setCategories] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Partial<Categoria> | null>(null);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('catalogo_categorias').select('*').order('nome');
        if (error) {
            console.error('Error fetching categories:', error.message);
            alert(`Erro ao buscar categorias: ${error.message}`);
        } else if (data) {
            setCategories(data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleSave = async (categoryData: Partial<Categoria>) => {
        const dataToSave = { nome: categoryData.nome!, descricao: categoryData.descricao };
        const { error } = categoryData.id ?
            await supabase.from('catalogo_categorias').update(dataToSave).eq('id', categoryData.id)
            : await supabase.from('catalogo_categorias').insert(dataToSave);
        
        if (error) {
            alert(`Erro ao salvar categoria: ${error.message}`);
        } else {
            fetchCategories();
        }
        setModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Tem certeza? Excluir uma categoria pode afetar as tatuagens associadas.')) {
            const { error } = await supabase.from('catalogo_categorias').delete().eq('id', id);
            if (error) {
                alert(`Erro ao excluir categoria: ${error.message}`);
            } else {
                fetchCategories();
            }
        }
    }
    
    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Categorias</h2>
                <button onClick={() => { setCurrentCategory({}); setModalOpen(true); }} className="flex items-center space-x-2 bg-brand-gold-500 text-brand-dark px-4 py-2 rounded-md hover:bg-brand-gold-600 transition-colors">
                    <PlusIcon />
                    <span>Nova Categoria</span>
                </button>
            </div>
            {loading ? <div className="flex justify-center p-8"><SpinnerIcon className="mx-auto text-brand-gold-500"/></div> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nome</th>
                                <th scope="col" className="px-6 py-3">Descrição</th>
                                <th scope="col" className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{cat.nome}</td>
                                    <td className="px-6 py-4">{cat.descricao || '-'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => { setCurrentCategory(cat); setModalOpen(true); }} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                                        <button onClick={() => handleDelete(cat.id)} className="text-red-500 hover:text-red-400"><TrashIcon /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
             <AdminModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={currentCategory?.id ? 'Editar Categoria' : 'Nova Categoria'}>
                <CategoryForm category={currentCategory} onSave={handleSave} onCancel={() => setModalOpen(false)} />
            </AdminModal>
        </div>
    );
};

const CategoryForm: React.FC<{category: Partial<Categoria> | null, onSave: (data: Partial<Categoria>) => void, onCancel: () => void}> = ({ category, onSave, onCancel }) => {
    const [formData, setFormData] = useState(category || {});
    
    useEffect(() => {
        setFormData(category || {});
    }, [category]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="nome" value={formData.nome || ''} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Nome da Categoria" required className="w-full bg-gray-800 p-2 rounded"/>
            <textarea name="descricao" value={formData.descricao || ''} onChange={e => setFormData({...formData, descricao: e.target.value})} placeholder="Descrição" className="w-full bg-gray-800 p-2 rounded"/>
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-gold-500 text-brand-dark rounded">Salvar</button>
            </div>
        </form>
    )
};


const SettingsManagement = () => {
    const { settings } = useApp();
    const [formData, setFormData] = useState<Partial<CompanySettings>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if(settings) setFormData(settings);
    }, [settings]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const { id, ...updateData } = formData;
        if(id) {
            const { error } = await supabase.from('configuracoes_empresa').update(updateData).eq('id', id);
            if (error) {
                alert(`Erro ao salvar configurações: ${error.message}`);
            } else {
                alert('Configurações salvas!');
                // Note: to see changes immediately, we'd need a way to refresh app context settings
            }
        }
        setSaving(false);
    };

     const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">Configurações da Empresa</h2>
            <form onSubmit={handleSave} className="space-y-4">
                <input type="text" name="nome_empresa" value={formData.nome_empresa || ''} onChange={handleChange} placeholder="Nome da Empresa" className="w-full bg-gray-800 p-2 rounded"/>
                <input type="text" name="whatsapp" value={formData.whatsapp || ''} onChange={handleChange} placeholder="Nº WhatsApp (com código do país)" className="w-full bg-gray-800 p-2 rounded"/>
                <input type="text" name="instagram" value={formData.instagram || ''} onChange={handleChange} placeholder="Usuário Instagram (sem @)" className="w-full bg-gray-800 p-2 rounded"/>
                <input type="text" name="endereco" value={formData.endereco || ''} onChange={handleChange} placeholder="Endereço" className="w-full bg-gray-800 p-2 rounded"/>
                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={saving} className="px-6 py-2 bg-brand-gold-500 text-brand-dark rounded disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
                </div>
            </form>
        </div>
    );
};

const BulkUpload = () => {
    const [filesWithDetails, setFilesWithDetails] = useState<{file: File, base64: string, details: Partial<Omit<CatalogoItem, 'id'>>}[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [categories, setCategories] = useState<Categoria[]>([]);
    const [isUploading, setUploading] = useState(false);
    
    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await supabase.from('catalogo_categorias').select('*');
            if (data) setCategories(data);
        };
        fetchCategories();
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploading(true);
        const processedFiles = await Promise.all(files.map(file => 
            new Promise<{file: File, base64: string, details: Partial<CatalogoItem>}>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve({
                    file,
                    base64: reader.result as string,
                    details: { nome: file.name.split('.').slice(0, -1).join('.'), preco: 0 }
                });
                reader.onerror = error => reject(error);
            })
        ));
        setFilesWithDetails(processedFiles);
        setCurrentStep(0);
        setUploading(false);
    };

    const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const {name, value} = e.target;
        const newFiles = [...filesWithDetails];
        const currentFile = newFiles[currentStep];
        
        if (name === 'local' || name === 'tamanho') {
            currentFile.details.detalhes = {...currentFile.details.detalhes, [name]: value };
        } else {
            (currentFile.details as any)[name] = value;
        }
        
        setFilesWithDetails(newFiles);
    };

    const handleSaveAll = async () => {
        setUploading(true);
        const itemsToInsert = filesWithDetails.map(f => ({
            nome: f.details.nome!,
            categoria_id: Number(f.details.categoria_id!),
            preco: Number(f.details.preco!),
            descricao: f.details.descricao,
            detalhes: f.details.detalhes,
            imagem_base64: f.base64,
        }));
        
        const { error } = await supabase.from('catalogo_itens').insert(itemsToInsert);

        if(error) {
            alert('Erro ao salvar: ' + error.message);
        } else {
            alert(`${itemsToInsert.length} tatuagens salvas com sucesso!`);
            setFilesWithDetails([]);
        }
        setUploading(false);
    };

    if (isUploading) return <div className="text-center p-8"><SpinnerIcon className="w-12 h-12 mx-auto text-brand-gold-500"/><p className="mt-4">Processando...</p></div>
    
    if (filesWithDetails.length === 0) {
        return (
            <div>
                 <h2 className="text-2xl font-bold text-white mb-4">Upload de Tatuagens em Massa</h2>
                 <p className="text-gray-400 mb-4">Selecione múltiplas imagens para adicionar ao catálogo de uma vez.</p>
                 <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-gold-100 file:text-brand-gold-700 hover:file:bg-brand-gold-200"/>
            </div>
        );
    }
    
    const currentFile = filesWithDetails[currentStep];

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">Editando Tatuagem {currentStep + 1} de {filesWithDetails.length}</h2>
            <div className="md:grid md:grid-cols-2 gap-8">
                <div>
                    <img src={currentFile.base64} alt="preview" className="w-full h-auto object-contain rounded-lg shadow-lg"/>
                </div>
                <div className="space-y-3 mt-4 md:mt-0">
                    <input type="text" name="nome" value={currentFile.details.nome || ''} onChange={handleDetailChange} placeholder="Nome" className="w-full bg-gray-800 p-2 rounded"/>
                    <select name="categoria_id" value={currentFile.details.categoria_id || ''} onChange={handleDetailChange} className="w-full bg-gray-800 p-2 rounded">
                        <option value="">Selecione a Categoria</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <input type="number" step="0.01" name="preco" value={currentFile.details.preco || ''} onChange={handleDetailChange} placeholder="Preço" className="w-full bg-gray-800 p-2 rounded"/>
                    <textarea name="descricao" value={currentFile.details.descricao || ''} onChange={handleDetailChange} placeholder="Descrição" className="w-full bg-gray-800 p-2 rounded"/>
                    <input type="text" name="local" value={currentFile.details.detalhes?.local || ''} onChange={handleDetailChange} placeholder="Local do corpo" className="w-full bg-gray-800 p-2 rounded"/>
                    <input type="text" name="tamanho" value={currentFile.details.detalhes?.tamanho || ''} onChange={handleDetailChange} placeholder="Tamanho" className="w-full bg-gray-800 p-2 rounded"/>
                </div>
            </div>
            <div className="flex justify-between items-center mt-8">
                <div>
                    <button onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 0} className="px-4 py-2 bg-gray-600 rounded disabled:opacity-50">Anterior</button>
                    <button onClick={() => setCurrentStep(p => p + 1)} disabled={currentStep === filesWithDetails.length - 1} className="ml-2 px-4 py-2 bg-gray-600 rounded disabled:opacity-50">Próximo</button>
                </div>
                <button onClick={handleSaveAll} className="px-6 py-3 bg-brand-gold-500 text-brand-dark rounded font-bold">Salvar Todas</button>
            </div>
        </div>
    )
};


export default AdminPage;