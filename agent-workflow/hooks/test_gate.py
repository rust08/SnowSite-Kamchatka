import tempfile, unittest, json, zipfile, hashlib
from pathlib import Path
from gate import inventory,verify_manifest,check_diff,sha_file
class GateTests(unittest.TestCase):
    def setUp(self): self.t=tempfile.TemporaryDirectory(); self.root=Path(self.t.name)
    def tearDown(self): self.t.cleanup()
    def z(self,n,items):
        p=self.root/n
        with zipfile.ZipFile(p,'w') as z:
            for k,v in items: z.writestr(k,v)
        return p
    def test_good_manifest(self):
        h=hashlib.sha256(b'x').hexdigest(); p=self.z('p.zip',[('x','x'),('MANIFEST.sha256',h+'  x\n')]); self.assertEqual(verify_manifest(*inventory(p)),1)
    def test_missing_manifest_member(self):
        p=self.z('p.zip',[('x','x'),('MANIFEST.sha256','')]); self.assertRaises(ValueError,verify_manifest,*inventory(p))
    def test_tamper(self):
        h=hashlib.sha256(b'x').hexdigest(); p=self.z('p.zip',[('x','y'),('MANIFEST.sha256',h+'  x\n')]); self.assertRaises(ValueError,verify_manifest,*inventory(p))
    def test_unsafe(self):
        for n in ['../x','/x','a\\b','a/../b','C:x','a/*']:
            with self.subTest(n=n): self.assertRaises(ValueError,inventory,self.z('p.zip',[(n,'x')]))
    def test_case_collision(self): self.assertRaises(ValueError,inventory,self.z('p.zip',[('x','a'),('X','b')]))
    def test_scope(self):
        a=self.z('a.zip',[('SnowSite-Kamchatka/x','x')]); b=self.z('b.zip',[('SnowSite-Kamchatka/x','y'),('SnowSite-Kamchatka/z','z')]); t=self.root/'task.json'
        task={'schema':'snowcontrol.task.v1','status':'GO','task_id':'TEST','owner_go_ref':'simulated test only','base_sha256':sha_file(a),'allowed_changes':{'x':'EDIT','z':'ADD'}}
        def save(): t.write_text(json.dumps(task))
        save(); self.assertEqual(check_diff(a,b,t)['actual_changes'],{'x':'EDIT','z':'ADD'})
        task['allowed_changes'].pop('z'); save(); self.assertRaises(ValueError,check_diff,a,b,t)
        task['allowed_changes']['z']='EDIT'; save(); self.assertRaises(ValueError,check_diff,a,b,t)
        task['status']='NO_GO'; save(); self.assertRaises(ValueError,check_diff,a,b,t)
        task['status']='GO'; task['base_sha256']='0'*64; save(); self.assertRaises(ValueError,check_diff,a,b,t)
if __name__=='__main__': unittest.main()
