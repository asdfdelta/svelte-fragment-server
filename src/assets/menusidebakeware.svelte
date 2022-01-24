<script>
    import { Accordion } from 'ashcomm-core-svelte';
    export const content = {
        Bakeware: [
            {
                facetName: 'Bakeware Sets',
                facetType: 'product',
                facetSelected: 'hierarchy selected',
                facetUrl: '/product-list-page/c/kitchen/bakeware/bakeware-sets/'
            },
            {
                facetName: 'Baking Dishes',
                facetType: 'product',
                facetSelected: 'hierarchy',
                facetUrl: '/product-list-page/c/kitchen/bakeware/baking-dishes/'
            },
            {
                facetName: 'Baking & Cookie Sheets',
                facetType: 'product',
                facetSelected: 'hierarchy',
                facetUrl: '/product-list-page/c/kitchen/bakeware/baking-sheets/'
            },
            {
                facetName: 'Cake Pans',
                facetType: 'product',
                facetSelected: 'hierarchy',
                facetUrl: '/product-list-page/c/kitchen/bakeware/cake-pans/'
            },
            {
                facetName: 'Loaf Pans',
                facetType: 'product',
                facetSelected: 'hierarchy',
                facetUrl: '/product-list-page/c/kitchen/bakeware/loaf-pans/'
            },
            {
                facetName: 'Muffin & Cupcake Pans',
                facetType: 'product',
                facetSelected: 'hierarchy',
                facetUrl: '/product-list-page/c/kitchen/bakeware/muffin-cupcake-pans/'
            }
        ]
    };
</script>

<Accordion {content} />
