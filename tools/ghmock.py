# Имитация нужной части GitHub REST API (Git Data + contents raw) для теста синхронизации
import json,hashlib,base64,re,sys
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
blobs={};trees={};commits={};ref={'sha':None};TOKEN='test-token';stats={'blobs':0}
def h(b):return hashlib.sha1(b).hexdigest()
def mkblob(b):s=h(b'blob'+b);blobs[s]=b;return s
def mktree(m):s=h(json.dumps(m,sort_keys=True).encode()+b'tree');trees[s]=dict(m);return s
def mkcommit(t,parents):s=h((t+''.join(parents)+str(len(commits))).encode());commits[s]={'tree':t,'parents':parents};return s
ref['sha']=mkcommit(mktree({'README.md':mkblob(b'# sync')}),[])
class H(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','Authorization, Accept, Content-Type');self.send_header('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS')
    def out(self,code,obj=None,raw=None):
        self.send_response(code);self.cors()
        body=raw if raw is not None else json.dumps(obj or {}).encode()
        self.send_header('Content-Type','application/octet-stream' if raw is not None else 'application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_OPTIONS(self):self.send_response(204);self.cors();self.end_headers()
    def auth(self):
        if self.headers.get('Authorization')!='Bearer '+TOKEN:self.out(401,{'message':'Bad credentials'});return False
        return True
    def body(self):n=int(self.headers.get('Content-Length',0));return json.loads(self.rfile.read(n) or b'{}')
    def do_GET(self):
        if not self.auth():return
        m=re.match(r'^/repos/([^/]+/[^/]+)(.*)$',self.path.split('?')[0]);p=m.group(2)
        if p=='':return self.out(200,{'private':True,'full_name':m.group(1)})
        if p=='/git/ref/heads/main':return self.out(200,{'object':{'sha':ref['sha']}})
        mm=re.match(r'^/git/commits/(\w+)$',p)
        if mm:c=commits[mm.group(1)];return self.out(200,{'sha':mm.group(1),'tree':{'sha':c['tree']}})
        mm=re.match(r'^/contents/(.+)$',p)
        if mm:
            q=dict(x.split('=') for x in self.path.split('?')[1].split('&')) if '?' in self.path else {}
            t=trees[commits[q.get('ref',ref['sha'])]['tree']];path=mm.group(1)
            if path not in t:return self.out(404,{'message':'Not Found'})
            return self.out(200,raw=blobs[t[path]])
        self.out(404,{'message':'Not Found'})
    def do_POST(self):
        if not self.auth():return
        p=re.match(r'^/repos/[^/]+/[^/]+(.*)$',self.path).group(1);b=self.body()
        if p=='/git/blobs':stats['blobs']+=1;return self.out(201,{'sha':mkblob(base64.b64decode(b['content']))})
        if p=='/git/trees':
            m=dict(trees[b['base_tree']])
            for e in b['tree']:
                if e['sha'] is None:m.pop(e['path'],None)
                else:m[e['path']]=e['sha']
            return self.out(201,{'sha':mktree(m)})
        if p=='/git/commits':return self.out(201,{'sha':mkcommit(b['tree'],b['parents'])})
        self.out(404)
    def do_PATCH(self):
        if not self.auth():return
        b=self.body();c=commits[b['sha']]
        if c['parents'][0]!=ref['sha']:return self.out(422,{'message':'Update is not a fast forward'})
        ref['sha']=b['sha'];self.out(200,{'object':{'sha':ref['sha']}})
    def do_PUT(self):self.out(404)
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),H).serve_forever()
