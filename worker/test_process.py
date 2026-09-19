import multiprocessing, pathlib, tempfile, unittest, time
from model_runtime import model_slot, ModelBusy
from excerpt_selection import select_excerpt

def contention(folder, out):
    try:
        with model_slot(pathlib.Path(folder),'briefing'):out.put('acquired')
    except ModelBusy:out.put('busy')

class ProcessTests(unittest.TestCase):
    def test_excerpts_are_grounded_and_reused(self):
        i={'title':'Global energy storage research','excerpt':'A short introduction. Global energy storage research reduces costs. Further testing is needed.'}
        self.assertEqual(select_excerpt(i),'Global energy storage research reduces costs.')
        i['summary']='Further testing is needed.'
        self.assertEqual(select_excerpt(i),i['summary'])
        i['summary']='An invented breakthrough.'
        self.assertIn(select_excerpt(i),i['excerpt'])
    def test_model_lock_cross_process(self):
        with tempfile.TemporaryDirectory() as d:
            out=multiprocessing.Queue()
            with model_slot(pathlib.Path(d),'briefing'):
                p=multiprocessing.Process(target=contention,args=(d,out));p.start();p.join(5)
                self.assertEqual(out.get(timeout=1),'busy')
            with model_slot(pathlib.Path(d),'briefing'):pass
    def test_waiting_translation_has_priority_and_marker_expires(self):
        with tempfile.TemporaryDirectory() as d:
            state=pathlib.Path(d);marker=state/'translation-waiting';marker.touch()
            with self.assertRaises(ModelBusy):
                with model_slot(state,'briefing'):pass
            with model_slot(state,'translation'):pass
            self.assertFalse(marker.exists())
            with model_slot(state,'briefing'):pass

if __name__=='__main__':unittest.main()
