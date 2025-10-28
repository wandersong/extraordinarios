# Scripts para Deploy do Build Estático

## 1. Teste Local com Servidor HTTP Simples

### Usando Python:
```bash
cd out
python -m http.server 8080
```

### Usando Node.js (serve):
```bash
npx serve out -p 8080
```

### Usando PHP:
```bash
cd out  
php -S localhost:8080
```

## 2. Deploy para Hosting Estático

### Vercel:
```bash
npm install -g vercel
vercel --prod --yes out/
```

### Netlify:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=out
```

### GitHub Pages:
1. Faça commit da pasta `out/`
2. Configure GitHub Pages para usar a pasta `out/` da branch main

## 3. Deploy para CDN/S3

### AWS S3:
```bash
aws s3 sync out/ s3://seu-bucket-name --delete --acl public-read
```

### Google Cloud Storage:
```bash
gsutil -m rsync -r -d out/ gs://seu-bucket-name
```

## 4. Configurações de Server (se necessário)

### Apache (.htaccess):
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Nginx:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## Notas Importantes:

- O build estático já inclui todas as dependências
- As variáveis de ambiente NEXT_PUBLIC_* são incorporadas no build
- O webhook funciona diretamente com o endpoint externo do n8n
- O cache local (localStorage) persiste as conversas
- A sincronização com Supabase funciona normalmente