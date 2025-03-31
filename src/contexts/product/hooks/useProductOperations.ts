
import { useCallback } from 'react';
import { Product, CriarProdutoInput } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { 
  adicionarProdutoAPI,
  editarProdutoAPI,
  removerProdutoAPI,
  obterProdutoPorIdAPI,
  obterProdutoPorSlugAPI
} from '../productApi';

interface UseProductOperationsProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  isOffline: boolean;
}

export const useProductOperations = ({ products, setProducts, isOffline }: UseProductOperationsProps) => {
  const { toast } = useToast();
  
  const addProduct = useCallback(async (productData: CriarProdutoInput): Promise<void> => {
    try {
      const newProduct = await adicionarProdutoAPI(productData);
      setProducts(prevProducts => [newProduct, ...prevProducts]);
      toast({
        title: "Produto adicionado",
        description: `O produto ${newProduct.nome} foi adicionado com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro ao adicionar produto:", error);
      toast({
        title: "Erro ao adicionar produto",
        description: error.message || "Ocorreu um erro ao adicionar o produto.",
        variant: "destructive",
      });
    }
  }, [setProducts, toast]);
  
  const editProduct = useCallback(async (id: string, productData: Partial<Product>): Promise<void> => {
    try {
      const updatedProduct = await editarProdutoAPI(id, productData);
      setProducts(prevProducts =>
        prevProducts.map(product => (product.id === id ? updatedProduct : product))
      );
      toast({
        title: "Produto atualizado",
        description: `O produto ${updatedProduct.nome} foi atualizado com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro ao atualizar produto:", error);
      toast({
        title: "Erro ao atualizar produto",
        description: error.message || "Ocorreu um erro ao atualizar o produto.",
        variant: "destructive",
      });
    }
  }, [setProducts, toast]);
  
  const removeProduct = useCallback(async (id: string): Promise<void> => {
    try {
      await removerProdutoAPI(id);
      setProducts(prevProducts => prevProducts.filter(product => product.id !== id));
      toast({
        title: "Produto removido",
        description: "O produto foi removido com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao remover produto:", error);
      toast({
        title: "Erro ao remover produto",
        description: error.message || "Ocorreu um erro ao remover o produto.",
        variant: "destructive",
      });
    }
  }, [setProducts, toast]);
  
  const getProductById = useCallback(async (id: string): Promise<Product | undefined> => {
    try {
      const product = await obterProdutoPorIdAPI(id);
      return product;
    } catch (error) {
      console.error("Erro ao buscar produto por ID:", error);
      toast({
        title: "Erro ao buscar produto",
        description: "Ocorreu um erro ao buscar o produto por ID.",
        variant: "destructive",
      });
      return undefined;
    }
  }, [toast]);

  const getProductBySlug = useCallback(
    async (slug: string): Promise<Product | undefined> => {
      console.log('getProductBySlug chamado com slug:', slug);
      
      if (!products || products.length === 0) {
        console.log('Nenhum produto disponível localmente');
      } else {
        console.log('Produtos atuais:', products);
        // Primeiro tentar encontrar o produto localmente
        const localProduct = products.find(p => p.slug === slug);
        if (localProduct) {
          console.log('Produto encontrado localmente:', localProduct);
          return localProduct;
        }
      }
      
      // Se não encontrar localmente e estivermos offline, retorne undefined
      if (isOffline) {
        console.log('Estamos offline e não encontramos o produto localmente');
        return undefined;
      }
      
      // Se não encontrar localmente, buscar da API
      try {
        console.log('Buscando produto na API pelo slug:', slug);
        const product = await obterProdutoPorSlugAPI(slug);
        console.log('Resposta da API:', product);
        return product;
      } catch (error) {
        console.error('Erro ao buscar produto por slug da API:', error);
        return undefined;
      }
    },
    [products, isOffline]
  );
  
  return {
    addProduct,
    editProduct,
    removeProduct,
    getProductById,
    getProductBySlug
  };
};
