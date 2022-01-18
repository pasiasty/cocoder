package server

import "sync"

type MemoryTextStorage struct {
	m    sync.Mutex
	text string
}

func (s *MemoryTextStorage) Text() string {
	s.m.Lock()
	defer s.m.Unlock()

	return s.text
}

func (s *MemoryTextStorage) UpdateText(es EditState, transform transformFunc) EditState {
	s.m.Lock()
	defer s.m.Unlock()

	res := transform(es, s.text)
	s.text = res.NewText
	return res
}
